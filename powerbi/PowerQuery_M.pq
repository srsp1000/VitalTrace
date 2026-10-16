/* =========================================================================================
   VitalTrace Power BI Semantic Model: Power Query M Transformation Scripts
   Target Role: Innovaccer Data Analyst Intern
   Repository: VitalTrace Health Analytics Engine
   Driver Requirements: Npgsql 4.0.10+ (64-bit) with GAC registration for Power BI Desktop
   PostgreSQL Port: 5432 (Direct) or 6543 (Supabase Transaction Pooler)
   Mode: Hybrid parameter-driven toggle (PostgreSQL Curated Views vs. Local CSV Import)
========================================================================================= */

// =========================================================================================
// SECTION 0: GLOBAL PARAMETERS (Create these in Power BI Desktop via "Manage Parameters")
// =========================================================================================

/*
Parameter: DataSourceMode
Description: Controls whether queries ingest live from PostgreSQL views or offline CSV fixtures.
Allowed Values: "CSV", "PostgreSQL"
Default: "CSV"
*/
let
    #"DataSourceMode" = "CSV" meta [
        IsParameterQuery = true, 
        Type = "Text", 
        IsParameterQueryRequired = true, 
        Description = "Toggle between CSV fixture files and PostgreSQL live database"
    ]
in
    #"DataSourceMode";

/*
Parameter: CsvFolderPath
Description: Local or network path hosting the 6 curated CSV files.
Default: "c:\Users\srsp1\OneDrive\Documents\VitalTrace\powerbi\data"
*/
let
    #"CsvFolderPath" = "c:\Users\srsp1\OneDrive\Documents\VitalTrace\powerbi\data" meta [
        IsParameterQuery = true, 
        Type = "Text", 
        IsParameterQueryRequired = true, 
        Description = "Absolute folder path containing the VitalTrace CSV data files"
    ]
in
    #"CsvFolderPath";

/*
Parameter: PgServerHost
Description: PostgreSQL Host FQDN (e.g. Supabase Project Host).
*/
let
    #"PgServerHost" = "aws-0-ap-southeast-2.pooler.supabase.com" meta [
        IsParameterQuery = true, 
        Type = "Text", 
        IsParameterQueryRequired = false, 
        Description = "PostgreSQL Server hostname or pooler endpoint"
    ]
in
    #"PgServerHost";

/*
Parameter: PgDatabaseName
Description: PostgreSQL Database Name.
Default: "postgres"
*/
let
    #"PgDatabaseName" = "postgres" meta [
        IsParameterQuery = true, 
        Type = "Text", 
        IsParameterQueryRequired = false, 
        Description = "Target PostgreSQL database catalog"
    ]
in
    #"PgDatabaseName";


// =========================================================================================
// SECTION 1: CORE DIMENSION & FACT TABLE M SCRIPTS
// =========================================================================================

/* -----------------------------------------------------------------------------------------
   QUERY 1: dim_documents
   Grain: 1 row per uploaded clinical document
----------------------------------------------------------------------------------------- */
let
    Source = if #"DataSourceMode" = "PostgreSQL" then
        let
            PgSource = PostgreSQL.Database(#"PgServerHost" & ":6543", #"PgDatabaseName"),
            PublicSchema = PgSource{[Schema="public"]}[Data],
            DocumentsTable = PublicSchema{[Name="documents"]}[Data]
        in
            DocumentsTable
    else
        let
            CsvFile = Csv.Document(
                File.Contents(#"CsvFolderPath" & "\dim_documents.csv"),
                [Delimiter=",", Columns=8, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
            ),
            PromotedHeaders = Table.PromoteHeaders(CsvFile, [PromoteAllScalars=true])
        in
            PromotedHeaders,

    // Step 1: Explicit Data Type Coercions
    TypedTable = Table.TransformColumnTypes(Source, {
        {"id", type text},
        {"profile_id", type text},
        {"original_filename", type text},
        {"mime_type", type text},
        {"file_size_bytes", Int64.Type},
        {"document_date", type date},
        {"processing_status", type text},
        {"created_at", type datetimezone}
    }),

    // Step 2: Clean Null Values and Defaults
    ReplacedNullStatus = Table.ReplaceValue(TypedTable, null, "uploaded", Replacer.ReplaceValue, {"processing_status"}),
    ReplacedNullSize = Table.ReplaceValue(ReplacedNullStatus, null, 0, Replacer.ReplaceValue, {"file_size_bytes"}),

    // Step 3: Add Computed File Size in KB for visual formatting
    AddedFileSizeKB = Table.AddColumn(ReplacedNullSize, "file_size_kb", each Number.Round([file_size_bytes] / 1024, 2), type number),

    // Step 4: Extract Clean File Extension
    AddedExtension = Table.AddColumn(AddedFileSizeKB, "file_extension", each Text.Upper(Text.AfterDelimiter([original_filename], ".", {0, RelativePosition.FromEnd})), type text)
in
    AddedExtension;


/* -----------------------------------------------------------------------------------------
   QUERY 2: fact_extraction_runs
   Grain: 1 row per pipeline execution attempt (tracks duration, OCR model, retries, errors)
----------------------------------------------------------------------------------------- */
let
    Source = if #"DataSourceMode" = "PostgreSQL" then
        let
            PgSource = PostgreSQL.Database(#"PgServerHost" & ":6543", #"PgDatabaseName"),
            PublicSchema = PgSource{[Schema="public"]}[Data],
            RunsTable = PublicSchema{[Name="extraction_runs"]}[Data]
        in
            RunsTable
    else
        let
            CsvFile = Csv.Document(
                File.Contents(#"CsvFolderPath" & "\fact_extraction_runs.csv"),
                [Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
            ),
            PromotedHeaders = Table.PromoteHeaders(CsvFile, [PromoteAllScalars=true])
        in
            PromotedHeaders,

    // Step 1: Explicit Data Type Coercions
    TypedTable = Table.TransformColumnTypes(Source, {
        {"id", type text},
        {"document_id", type text},
        {"model_name", type text},
        {"status", type text},
        {"started_at", type datetimezone},
        {"completed_at", type datetimezone},
        {"extracted_count", Int64.Type},
        {"validation_issue_count", Int64.Type},
        {"duration_ms", Int64.Type},
        {"error_message", type text}
    }),

    // Step 2: Coalesce Null Error Messages and durations
    CleanedErrorMessage = Table.ReplaceValue(TypedTable, null, "", Replacer.ReplaceValue, {"error_message"}),
    CleanedExtractedCount = Table.ReplaceValue(CleanedErrorMessage, null, 0, Replacer.ReplaceValue, {"extracted_count"}),
    CleanedIssueCount = Table.ReplaceValue(CleanedExtractedCount, null, 0, Replacer.ReplaceValue, {"validation_issue_count"}),

    // Step 3: Compute Duration in Seconds and Latency SLA Tier
    AddedDurationSec = Table.AddColumn(CleanedIssueCount, "duration_seconds", each if [duration_ms] <> null then Number.Round([duration_ms] / 1000, 2) else null, type number),
    AddedSlaCategory = Table.AddColumn(AddedDurationSec, "latency_tier", each 
        if [duration_ms] = null then "N/A"
        else if [duration_ms] <= 2500 then "Fast (< 2.5s)"
        else if [duration_ms] <= 5000 then "Acceptable (2.5 - 5s)"
        else "Degraded (> 5s)", 
        type text
    )
in
    AddedSlaCategory;


/* -----------------------------------------------------------------------------------------
   QUERY 3: fact_observations
   Grain: 1 row per extracted clinical laboratory analyte
----------------------------------------------------------------------------------------- */
let
    Source = if #"DataSourceMode" = "PostgreSQL" then
        let
            PgSource = PostgreSQL.Database(#"PgServerHost" & ":6543", #"PgDatabaseName"),
            PublicSchema = PgSource{[Schema="public"]}[Data],
            ObsTable = PublicSchema{[Name="observations"]}[Data]
        in
            ObsTable
    else
        let
            CsvFile = Csv.Document(
                File.Contents(#"CsvFolderPath" & "\fact_observations.csv"),
                [Delimiter=",", Columns=11, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
            ),
            PromotedHeaders = Table.PromoteHeaders(CsvFile, [PromoteAllScalars=true])
        in
            PromotedHeaders,

    // Step 1: Explicit Data Type Coercions
    TypedTable = Table.TransformColumnTypes(Source, {
        {"id", type text},
        {"profile_id", type text},
        {"document_id", type text},
        {"extraction_run_id", type text},
        {"canonical_test_name", type text},
        {"loinc_code", type text},
        {"value_numeric", type number},
        {"original_unit", type text},
        {"observation_date", type date},
        {"validation_status", type text},
        {"verified_by_user", type text}
    }),

    // Step 2: Handle Blank Units and Missing Statuses
    CleanedUnit = Table.ReplaceValue(TypedTable, "", "MISSING_UNIT", Replacer.ReplaceValue, {"original_unit"}),
    CoalescedUnit = Table.ReplaceValue(CleanedUnit, null, "MISSING_UNIT", Replacer.ReplaceValue, {"original_unit"}),
    CleanedValidationStatus = Table.ReplaceValue(CoalescedUnit, null, "valid", Replacer.ReplaceValue, {"validation_status"}),
    CleanedVerification = Table.ReplaceValue(CleanedValidationStatus, null, "pending", Replacer.ReplaceValue, {"verified_by_user"}),

    // Step 3: Flag Completeness Status
    AddedCompletenessFlag = Table.AddColumn(CleanedVerification, "is_complete_record", each 
        [value_numeric] <> null and [original_unit] <> "MISSING_UNIT", 
        type logical
    )
in
    AddedCompletenessFlag;


/* -----------------------------------------------------------------------------------------
   QUERY 4: fact_validation_issues
   Grain: 1 row per deterministic rule discrepancy
----------------------------------------------------------------------------------------- */
let
    Source = if #"DataSourceMode" = "PostgreSQL" then
        let
            PgSource = PostgreSQL.Database(#"PgServerHost" & ":6543", #"PgDatabaseName"),
            PublicSchema = PgSource{[Schema="public"]}[Data],
            IssuesTable = PublicSchema{[Name="validation_issues"]}[Data]
        in
            IssuesTable
    else
        let
            CsvFile = Csv.Document(
                File.Contents(#"CsvFolderPath" & "\fact_validation_issues.csv"),
                [Delimiter=",", Columns=8, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
            ),
            PromotedHeaders = Table.PromoteHeaders(CsvFile, [PromoteAllScalars=true])
        in
            PromotedHeaders,

    // Step 1: Coerce Boolean Strings from CSV before standard type transformation
    ConvertedLogical = if #"DataSourceMode" = "CSV" then
        Table.TransformColumns(Source, {
            {"resolved", each if _ = "TRUE" or _ = "true" or _ = true then true else false, type logical}
        })
    else
        Source,

    // Step 2: Explicit Data Type Coercions
    TypedTable = Table.TransformColumnTypes(ConvertedLogical, {
        {"id", type text},
        {"document_id", type text},
        {"extraction_run_id", type text},
        {"observation_id", type text},
        {"issue_type", type text},
        {"severity", type text},
        {"resolved", type logical},
        {"created_at", type datetimezone}
    }),

    // Step 3: Clean Null Foreign Keys for Orphaned or Global Issues
    CleanedObsId = Table.ReplaceValue(TypedTable, "", null, Replacer.ReplaceValue, {"observation_id"}),

    // Step 4: Add Severity Sort Order for Visual Slicers
    AddedSeverityRank = Table.AddColumn(CleanedObsId, "severity_rank", each 
        if [severity] = "error" then 1
        else if [severity] = "warning" then 2
        else 3, 
        Int64.Type
    )
in
    AddedSeverityRank;


/* -----------------------------------------------------------------------------------------
   QUERY 5: dim_analytes
   Grain: 1 row per canonical clinical laboratory test (LOINC mapping)
----------------------------------------------------------------------------------------- */
let
    Source = Csv.Document(
        File.Contents(#"CsvFolderPath" & "\dim_analytes.csv"),
        [Delimiter=",", Columns=6, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
    ),
    PromotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),

    // Step 1: Explicit Data Type Coercions
    TypedTable = Table.TransformColumnTypes(PromotedHeaders, {
        {"canonical_test_name", type text},
        {"loinc_code", type text},
        {"category", type text},
        {"typical_unit", type text},
        {"reference_low", type number},
        {"reference_high", type number}
    }),

    // Step 2: Add Display Label combining analyte and standard LOINC code
    AddedDisplayLabel = Table.AddColumn(TypedTable, "analyte_display_label", each 
        [canonical_test_name] & " (" & [loinc_code] & ")", 
        type text
    )
in
    AddedDisplayLabel;


/* -----------------------------------------------------------------------------------------
   QUERY 6: dim_calendar
   Grain: 1 row per day from 2024-01-01 to 2025-12-31
----------------------------------------------------------------------------------------- */
let
    Source = Csv.Document(
        File.Contents(#"CsvFolderPath" & "\dim_calendar.csv"),
        [Delimiter=",", Columns=7, Encoding=65001, QuoteStyle=QuoteStyle.Csv]
    ),
    PromotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),

    // Step 1: Coerce Boolean String from CSV
    ConvertedLogical = Table.TransformColumns(PromotedHeaders, {
        {"is_weekend", each if _ = "TRUE" or _ = "true" or _ = true then true else false, type logical}
    }),

    // Step 2: Explicit Data Type Coercions
    TypedTable = Table.TransformColumnTypes(ConvertedLogical, {
        {"date", type date},
        {"year", Int64.Type},
        {"month", Int64.Type},
        {"month_name", type text},
        {"quarter", type text},
        {"week_of_year", Int64.Type},
        {"is_weekend", type logical}
    }),

    // Step 3: Add Year-Month Sort Column (e.g. 202401)
    AddedYearMonthKey = Table.AddColumn(TypedTable, "year_month_key", each 
        [year] * 100 + [month], 
        Int64.Type
    ),

    // Step 4: Add Year-Month Short Display (e.g. "Jan 2024")
    AddedMonthYear = Table.AddColumn(AddedYearMonthKey, "month_year_display", each 
        Text.Start([month_name], 3) & " " & Text.From([year]), 
        type text
    )
in
    AddedMonthYear;


// =========================================================================================
// SECTION 2: CURATED POSTGRESQL ANALYTICAL VIEW QUERIES (Migration 004 Integration)
// These queries connect directly to the curated pre-aggregated SQL views when in PostgreSQL mode.
// =========================================================================================

/* -----------------------------------------------------------------------------------------
   QUERY 7: view_extraction_run_health
   Source: public.view_extraction_run_health (Pre-aggregated Model Health)
----------------------------------------------------------------------------------------- */
let
    Source = if #"DataSourceMode" = "PostgreSQL" then
        let
            PgSource = PostgreSQL.Database(#"PgServerHost" & ":6543", #"PgDatabaseName"),
            PublicSchema = PgSource{[Schema="public"]}[Data],
            ViewTable = PublicSchema{[Name="view_extraction_run_health"]}[Data],
            TypedView = Table.TransformColumnTypes(ViewTable, {
                {"profile_id", type text},
                {"model_name", type text},
                {"total_runs", Int64.Type},
                {"successful_runs", Int64.Type},
                {"failed_runs", Int64.Type},
                {"running_runs", Int64.Type},
                {"success_rate_percentage", type number},
                {"avg_duration_ms", type number}
            })
        in
            TypedView
    else
        // Fallback aggregation in M from imported runs table
        let
            Runs = fact_extraction_runs,
            Grouped = Table.Group(Runs, {"model_name"}, {
                {"total_runs", each Table.RowCount(_), Int64.Type},
                {"successful_runs", each Table.RowCount(Table.SelectRows(_, each [status] = "completed")), Int64.Type},
                {"failed_runs", each Table.RowCount(Table.SelectRows(_, each [status] = "failed")), Int64.Type},
                {"avg_duration_ms", each Number.Round(List.Average(List.RemoveNulls([duration_ms])), 0), type number}
            }),
            AddedRate = Table.AddColumn(Grouped, "success_rate_percentage", each 
                if [total_runs] > 0 then Number.Round(([successful_runs] / [total_runs]) * 100, 1) else 0, 
                type number
            )
        in
            AddedRate
in
    Source;


/* -----------------------------------------------------------------------------------------
   QUERY 8: view_run_quality_telemetry
   Source: public.view_run_quality_telemetry (CTE join avoiding Cartesian product)
----------------------------------------------------------------------------------------- */
let
    Source = if #"DataSourceMode" = "PostgreSQL" then
        let
            PgSource = PostgreSQL.Database(#"PgServerHost" & ":6543", #"PgDatabaseName"),
            PublicSchema = PgSource{[Schema="public"]}[Data],
            ViewTable = PublicSchema{[Name="view_run_quality_telemetry"]}[Data],
            TypedView = Table.TransformColumnTypes(ViewTable, {
                {"run_id", type text},
                {"document_id", type text},
                {"profile_id", type text},
                {"original_filename", type text},
                {"model_name", type text},
                {"run_status", type text},
                {"started_at", type datetimezone},
                {"completed_at", type datetimezone},
                {"duration_ms", Int64.Type},
                {"extracted_count", Int64.Type},
                {"observations_persisted", Int64.Type},
                {"valid_observations_count", Int64.Type},
                {"warning_observations_count", Int64.Type},
                {"error_observations_count", Int64.Type},
                {"issues_flagged", Int64.Type},
                {"critical_issues_count", Int64.Type},
                {"warning_issues_count", Int64.Type},
                {"pass_rate_percentage", type number}
            })
        in
            TypedView
    else
        // Fallback simulated join for offline CSV mode
        let
            Runs = fact_extraction_runs,
            Docs = dim_documents,
            MergedDoc = Table.NestedJoin(Runs, {"document_id"}, Docs, {"id"}, "DocRecord", JoinKind.LeftOuter),
            ExpandedDoc = Table.ExpandTableColumn(MergedDoc, "DocRecord", {"original_filename", "profile_id"}, {"original_filename", "profile_id"})
        in
            ExpandedDoc
in
    Source;
