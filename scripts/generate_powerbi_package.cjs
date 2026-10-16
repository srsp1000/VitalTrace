const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const powerBiDir = path.join(rootDir, 'powerbi');
const semanticModelDir = path.join(powerBiDir, 'VitalTrace_Analytics.SemanticModel');
const reportDir = path.join(powerBiDir, 'VitalTrace_Analytics.Report');

// Ensure directories exist
fs.mkdirSync(semanticModelDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

// 1. VitalTrace_Analytics.pbip
const pbip = {
  version: "1.0",
  artifacts: [
    {
      report: {
        path: "VitalTrace_Analytics.Report"
      }
    }
  ],
  settings: {
    enableAutoAuth: true
  }
};
fs.writeFileSync(path.join(powerBiDir, 'VitalTrace_Analytics.pbip'), JSON.stringify(pbip, null, 2), 'utf-8');

// 2. definition.pbidataset
const pbidataset = {
  version: "1.0",
  settings: {}
};
fs.writeFileSync(path.join(semanticModelDir, 'definition.pbidataset'), JSON.stringify(pbidataset, null, 2), 'utf-8');

// 3. definition.pbir
const pbir = {
  version: "1.0",
  datasetReference: {
    byPath: {
      path: "../VitalTrace_Analytics.SemanticModel"
    },
    byConnection: null
  }
};
fs.writeFileSync(path.join(reportDir, 'definition.pbir'), JSON.stringify(pbir, null, 2), 'utf-8');

// 4. model.bim (Tabular Model Definition)
const measures = [
  // Page 1: Executive Overview
  { name: "Total Documents", expression: "DISTINCTCOUNT(dim_documents[id])", formatString: "#,0" },
  { name: "Total Extraction Runs", expression: "DISTINCTCOUNT(fact_extraction_runs[id])", formatString: "#,0" },
  { name: "Unique Documents Processed", expression: "DISTINCTCOUNT(fact_extraction_runs[document_id])", formatString: "#,0" },
  { name: "Retry Rate %", expression: "DIVIDE([Total Extraction Runs] - [Unique Documents Processed], [Unique Documents Processed], 0) * 100", formatString: "0.0%" },
  { name: "Successful Runs", expression: 'CALCULATE([Total Extraction Runs], fact_extraction_runs[status] = "completed")', formatString: "#,0" },
  { name: "Failed Runs", expression: 'CALCULATE([Total Extraction Runs], fact_extraction_runs[status] = "failed")', formatString: "#,0" },
  { name: "Run Success Rate %", expression: "DIVIDE([Successful Runs], [Successful Runs] + [Failed Runs], 0) * 100", formatString: "0.0%" },
  { name: "Total Observations", expression: "COUNTROWS(fact_observations)", formatString: "#,0" },
  { name: "Confirmed Observations", expression: 'CALCULATE([Total Observations], fact_observations[verified_by_user] = "confirmed")', formatString: "#,0" },
  { name: "Pending Review", expression: 'CALCULATE([Total Observations], fact_observations[verified_by_user] = "pending")', formatString: "#,0" },
  { name: "Confirmation Rate %", expression: "DIVIDE([Confirmed Observations], [Total Observations], 0) * 100", formatString: "0.0%" },
  { name: "Review Backlog Priority Flag", expression: 'SWITCH(TRUE(), [Pending Review] > 5, "High Backlog", [Pending Review] > 0, "Normal Backlog", "Clear")' },

  // Page 2: Data Quality & Clinical Governance
  { name: "Observations Missing Unit", expression: 'CALCULATE([Total Observations], fact_observations[original_unit] = "" || ISBLANK(fact_observations[original_unit]))', formatString: "#,0" },
  { name: "Observations Missing Value", expression: 'CALCULATE([Total Observations], ISBLANK(fact_observations[value_numeric]))', formatString: "#,0" },
  { name: "Duplicate Observations", expression: 'CALCULATE(COUNTROWS(fact_validation_issues), fact_validation_issues[issue_type] = "duplicate_observation")', formatString: "#,0" },
  { name: "Unmapped Analytes", expression: 'CALCULATE(COUNTROWS(fact_validation_issues), fact_validation_issues[issue_type] = "unmapped_test")', formatString: "#,0" },
  { name: "Open Issues", expression: 'CALCULATE(COUNTROWS(fact_validation_issues), fact_validation_issues[resolved] = FALSE())', formatString: "#,0" },
  { name: "Resolved Issues", expression: 'CALCULATE(COUNTROWS(fact_validation_issues), fact_validation_issues[resolved] = TRUE())', formatString: "#,0" },
  { name: "Issue Resolution Rate %", expression: "DIVIDE([Resolved Issues], COUNTROWS(fact_validation_issues), 0) * 100", formatString: "0.0%" },
  { name: "Validation Pass Rate %", expression: 'DIVIDE(CALCULATE([Total Observations], fact_observations[validation_status] = "valid"), [Total Observations], 0) * 100', formatString: "0.0%" },

  // Page 3: Pipeline Performance & Latency
  { name: "Avg Processing Duration (s)", expression: "AVERAGE(fact_extraction_runs[duration_ms]) / 1000", formatString: "0.00" },
  { name: "Max Duration (s)", expression: "MAX(fact_extraction_runs[duration_ms]) / 1000", formatString: "0.00" },
  { name: "Min Duration (s)", expression: "MIN(fact_extraction_runs[duration_ms]) / 1000", formatString: "0.00" },
  { name: "P50 Latency (s)", expression: "PERCENTILE.INC(fact_extraction_runs[duration_ms], 0.5) / 1000", formatString: "0.00" },
  { name: "P95 Latency (s)", expression: "PERCENTILE.INC(fact_extraction_runs[duration_ms], 0.95) / 1000", formatString: "0.00" },
  { name: "Documents with Failures", expression: 'CALCULATE(DISTINCTCOUNT(fact_extraction_runs[document_id]), fact_extraction_runs[status] = "failed")', formatString: "#,0" },
  { name: "Failure Rate %", expression: "DIVIDE([Failed Runs], [Total Extraction Runs], 0) * 100", formatString: "0.0%" },
  { name: "SLA Compliance %", expression: "DIVIDE(CALCULATE([Total Extraction Runs], fact_extraction_runs[duration_ms] <= 5000), [Total Extraction Runs], 0) * 100", formatString: "0.0%" },

  // Page 4: Analytical Explorer & Drill-Through
  { name: "Selected Document Runs", expression: "CALCULATE([Total Extraction Runs], ALLSELECTED(dim_documents))", formatString: "#,0" },
  { name: "Selected Observations", expression: "CALCULATE([Total Observations], ALLSELECTED(dim_documents))", formatString: "#,0" }
];

const modelBim = {
  name: "VitalTrace_Analytics",
  compatibilityLevel: 1550,
  model: {
    culture: "en-US",
    dataAccessOptions: {
      legacyRedirects: true,
      returnErrorValuesAsNull: true
    },
    defaultPowerBIDataSourceVersion: "powerBI_V3",
    sourceQueryCulture: "en-US",
    tables: [
      {
        name: "dim_documents",
        columns: [
          { name: "id", dataType: "string", isKey: true },
          { name: "profile_id", dataType: "string" },
          { name: "original_filename", dataType: "string" },
          { name: "document_type", dataType: "string" },
          { name: "document_date", dataType: "dateTime", formatString: "yyyy-MM-dd" },
          { name: "file_size_bytes", dataType: "int64" },
          { name: "file_size_kb", dataType: "double" },
          { name: "checksum", dataType: "string" },
          { name: "processing_status", dataType: "string" },
          { name: "created_at", dataType: "dateTime" }
        ],
        partitions: [
          {
            name: "dim_documents-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: [
                'let',
                '    Source = Csv.Document(File.Contents("c:\\Users\\srsp1\\OneDrive\\Documents\\VitalTrace\\powerbi\\data\\dim_documents.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.Csv]),',
                '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',
                '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"id", type text}, {"profile_id", type text}, {"original_filename", type text}, {"document_type", type text}, {"document_date", type date}, {"file_size_bytes", Int64.Type}, {"file_size_kb", type number}, {"checksum", type text}, {"processing_status", type text}, {"created_at", type datetime}})',
                'in',
                '    #"Changed Type"'
              ].join('\n')
            }
          }
        ]
      },
      {
        name: "fact_extraction_runs",
        columns: [
          { name: "id", dataType: "string", isKey: true },
          { name: "document_id", dataType: "string" },
          { name: "model_name", dataType: "string" },
          { name: "status", dataType: "string" },
          { name: "started_at", dataType: "dateTime" },
          { name: "completed_at", dataType: "dateTime" },
          { name: "extracted_count", dataType: "int64" },
          { name: "validation_issue_count", dataType: "int64" },
          { name: "duration_ms", dataType: "int64" },
          { name: "duration_seconds", dataType: "double" },
          { name: "error_message", dataType: "string" }
        ],
        partitions: [
          {
            name: "fact_extraction_runs-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: [
                'let',
                '    Source = Csv.Document(File.Contents("c:\\Users\\srsp1\\OneDrive\\Documents\\VitalTrace\\powerbi\\data\\fact_extraction_runs.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.Csv]),',
                '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',
                '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"id", type text}, {"document_id", type text}, {"model_name", type text}, {"status", type text}, {"started_at", type datetime}, {"completed_at", type datetime}, {"extracted_count", Int64.Type}, {"validation_issue_count", Int64.Type}, {"duration_ms", Int64.Type}, {"error_message", type text}}),',
                '    #"Added Duration Seconds" = Table.AddColumn(#"Changed Type", "duration_seconds", each [duration_ms] / 1000, type number)',
                'in',
                '    #"Added Duration Seconds"'
              ].join('\n')
            }
          }
        ]
      },
      {
        name: "fact_observations",
        columns: [
          { name: "id", dataType: "string", isKey: true },
          { name: "profile_id", dataType: "string" },
          { name: "document_id", dataType: "string" },
          { name: "extraction_run_id", dataType: "string" },
          { name: "canonical_test_name", dataType: "string" },
          { name: "loinc_code", dataType: "string" },
          { name: "value_numeric", dataType: "double" },
          { name: "original_unit", dataType: "string" },
          { name: "observation_date", dataType: "dateTime", formatString: "yyyy-MM-dd" },
          { name: "validation_status", dataType: "string" },
          { name: "verified_by_user", dataType: "string" }
        ],
        partitions: [
          {
            name: "fact_observations-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: [
                'let',
                '    Source = Csv.Document(File.Contents("c:\\Users\\srsp1\\OneDrive\\Documents\\VitalTrace\\powerbi\\data\\fact_observations.csv"),[Delimiter=",", Columns=11, Encoding=65001, QuoteStyle=QuoteStyle.Csv]),',
                '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',
                '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"id", type text}, {"profile_id", type text}, {"document_id", type text}, {"extraction_run_id", type text}, {"canonical_test_name", type text}, {"loinc_code", type text}, {"value_numeric", type number}, {"original_unit", type text}, {"observation_date", type date}, {"validation_status", type text}, {"verified_by_user", type text}})',
                'in',
                '    #"Changed Type"'
              ].join('\n')
            }
          }
        ]
      },
      {
        name: "fact_validation_issues",
        columns: [
          { name: "id", dataType: "string", isKey: true },
          { name: "document_id", dataType: "string" },
          { name: "extraction_run_id", dataType: "string" },
          { name: "observation_id", dataType: "string" },
          { name: "issue_type", dataType: "string" },
          { name: "severity", dataType: "string" },
          { name: "resolved", dataType: "boolean" },
          { name: "created_at", dataType: "dateTime" }
        ],
        partitions: [
          {
            name: "fact_validation_issues-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: [
                'let',
                '    Source = Csv.Document(File.Contents("c:\\Users\\srsp1\\OneDrive\\Documents\\VitalTrace\\powerbi\\data\\fact_validation_issues.csv"),[Delimiter=",", Columns=8, Encoding=65001, QuoteStyle=QuoteStyle.Csv]),',
                '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',
                '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"id", type text}, {"document_id", type text}, {"extraction_run_id", type text}, {"observation_id", type text}, {"issue_type", type text}, {"severity", type text}, {"resolved", type logical}, {"created_at", type datetime}})',
                'in',
                '    #"Changed Type"'
              ].join('\n')
            }
          }
        ]
      },
      {
        name: "dim_analytes",
        columns: [
          { name: "canonical_test_name", dataType: "string", isKey: true },
          { name: "loinc_code", dataType: "string" },
          { name: "standard_unit", dataType: "string" },
          { name: "category", dataType: "string" },
          { name: "normal_range_min", dataType: "double" },
          { name: "normal_range_max", dataType: "double" }
        ],
        partitions: [
          {
            name: "dim_analytes-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: [
                'let',
                '    Source = Csv.Document(File.Contents("c:\\Users\\srsp1\\OneDrive\\Documents\\VitalTrace\\powerbi\\data\\dim_analytes.csv"),[Delimiter=",", Columns=6, Encoding=65001, QuoteStyle=QuoteStyle.Csv]),',
                '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',
                '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"canonical_test_name", type text}, {"loinc_code", type text}, {"standard_unit", type text}, {"category", type text}, {"normal_range_min", type number}, {"normal_range_max", type number}})',
                'in',
                '    #"Changed Type"'
              ].join('\n')
            }
          }
        ]
      },
      {
        name: "dim_calendar",
        dataCategory: "Time",
        columns: [
          { name: "date", dataType: "dateTime", isKey: true, formatString: "yyyy-MM-dd" },
          { name: "year", dataType: "int64" },
          { name: "quarter", dataType: "string" },
          { name: "month_number", dataType: "int64" },
          { name: "month_name", dataType: "string" },
          { name: "month_year", dataType: "string" },
          { name: "week_number", dataType: "int64" },
          { name: "day_of_week", dataType: "int64" },
          { name: "day_name", dataType: "string" },
          { name: "is_weekend", dataType: "boolean" }
        ],
        partitions: [
          {
            name: "dim_calendar-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: [
                'let',
                '    Source = Csv.Document(File.Contents("c:\\Users\\srsp1\\OneDrive\\Documents\\VitalTrace\\powerbi\\data\\dim_calendar.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.Csv]),',
                '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',
                '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"date", type date}, {"year", Int64.Type}, {"quarter", type text}, {"month_number", Int64.Type}, {"month_name", type text}, {"month_year", type text}, {"week_number", Int64.Type}, {"day_of_week", Int64.Type}, {"day_name", type text}, {"is_weekend", type logical}})',
                'in',
                '    #"Changed Type"'
              ].join('\n')
            }
          }
        ]
      },
      {
        name: "_Measures",
        columns: [
          { name: "MeasurePlaceholder", dataType: "string", isHidden: true }
        ],
        partitions: [
          {
            name: "_Measures-Partition",
            mode: "import",
            source: {
              type: "m",
              expression: 'let Source = #table(type table [MeasurePlaceholder = text], {{"Placeholder"}}) in Source'
            }
          }
        ],
        measures: measures.map(m => ({
          name: m.name,
          expression: m.expression,
          formatString: m.formatString
        }))
      }
    ],
    relationships: [
      {
        name: "rel_documents_runs",
        fromTable: "fact_extraction_runs",
        fromColumn: "document_id",
        toTable: "dim_documents",
        toColumn: "id",
        crossFilteringBehavior: "oneDirection"
      },
      {
        name: "rel_documents_observations",
        fromTable: "fact_observations",
        fromColumn: "document_id",
        toTable: "dim_documents",
        toColumn: "id",
        crossFilteringBehavior: "oneDirection"
      },
      {
        name: "rel_documents_issues",
        fromTable: "fact_validation_issues",
        fromColumn: "document_id",
        toTable: "dim_documents",
        toColumn: "id",
        crossFilteringBehavior: "oneDirection"
      },
      {
        name: "rel_analytes_observations",
        fromTable: "fact_observations",
        fromColumn: "canonical_test_name",
        toTable: "dim_analytes",
        toColumn: "canonical_test_name",
        crossFilteringBehavior: "oneDirection"
      },
      {
        name: "rel_calendar_observations",
        fromTable: "fact_observations",
        fromColumn: "observation_date",
        toTable: "dim_calendar",
        toColumn: "date",
        crossFilteringBehavior: "oneDirection",
        isActive: true
      },
      {
        name: "rel_calendar_documents",
        fromTable: "dim_documents",
        fromColumn: "document_date",
        toTable: "dim_calendar",
        toColumn: "date",
        crossFilteringBehavior: "oneDirection",
        isActive: false
      }
    ]
  }
};

fs.writeFileSync(path.join(semanticModelDir, 'model.bim'), JSON.stringify(modelBim, null, 2), 'utf-8');

// 5. report.json (4 Report Pages)
const report = {
  config: JSON.stringify({
    version: "5.50",
    themeCollection: {
      baseTheme: { name: "vitaltrace_theme", version: "1.0", type: 2 }
    },
    activeSectionIndex: 0,
    defaultDrillFilterOtherVisuals: true
  }),
  layoutOptimization: 0,
  sections: [
    {
      name: "ReportSection_ExecutiveOverview",
      displayName: "Page 1 — Executive Overview",
      filters: "[]",
      ordinal: 0,
      width: 1280,
      height: 720,
      visualContainers: [
        {
          x: 20, y: 20, z: 1, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_TotalDocs",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Total Documents" }] }
            }
          })
        },
        {
          x: 230, y: 20, z: 2, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_UniqueDocs",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Unique Documents Processed" }] }
            }
          })
        },
        {
          x: 440, y: 20, z: 3, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_SuccessRate",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Run Success Rate %" }] }
            }
          })
        },
        {
          x: 650, y: 20, z: 4, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_RetryRate",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Retry Rate %" }] }
            }
          })
        },
        {
          x: 860, y: 20, z: 5, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_ConfirmationRate",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Confirmation Rate %" }] }
            }
          })
        },
        {
          x: 1070, y: 20, z: 6, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_PendingReview",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Pending Review" }] }
            }
          })
        },
        {
          x: 20, y: 140, z: 7, width: 610, height: 260,
          config: JSON.stringify({
            name: "Chart_IngestionTrends",
            singleVisual: {
              visualType: "areaChart",
              projections: {
                Category: [{ queryRef: "dim_calendar.date" }],
                Y: [{ queryRef: "_Measures.Total Extraction Runs" }, { queryRef: "_Measures.Total Observations" }]
              }
            }
          })
        },
        {
          x: 650, y: 140, z: 8, width: 610, height: 260,
          config: JSON.stringify({
            name: "Chart_VerificationFunnel",
            singleVisual: {
              visualType: "funnel",
              projections: {
                Category: [{ queryRef: "fact_observations.verified_by_user" }],
                Y: [{ queryRef: "_Measures.Total Observations" }]
              }
            }
          })
        },
        {
          x: 20, y: 420, z: 9, width: 1240, height: 280,
          config: JSON.stringify({
            name: "Table_ExecutiveSummary",
            singleVisual: {
              visualType: "tableEx",
              projections: {
                Values: [
                  { queryRef: "dim_documents.original_filename" },
                  { queryRef: "dim_documents.document_type" },
                  { queryRef: "dim_documents.processing_status" },
                  { queryRef: "_Measures.Total Observations" },
                  { queryRef: "_Measures.Confirmed Observations" }
                ]
              }
            }
          })
        }
      ]
    },
    {
      name: "ReportSection_DataQuality",
      displayName: "Page 2 — Data Quality",
      filters: "[]",
      ordinal: 1,
      width: 1280,
      height: 720,
      visualContainers: [
        {
          x: 20, y: 20, z: 1, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_ValidationPassRate",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Validation Pass Rate %" }] }
            }
          })
        },
        {
          x: 230, y: 20, z: 2, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_MissingUnit",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Observations Missing Unit" }] }
            }
          })
        },
        {
          x: 440, y: 20, z: 3, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_MissingValue",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Observations Missing Value" }] }
            }
          })
        },
        {
          x: 650, y: 20, z: 4, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_DuplicateObs",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Duplicate Observations" }] }
            }
          })
        },
        {
          x: 860, y: 20, z: 5, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_UnmappedAnalytes",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Unmapped Analytes" }] }
            }
          })
        },
        {
          x: 1070, y: 20, z: 6, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_IssueResolutionRate",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Issue Resolution Rate %" }] }
            }
          })
        },
        {
          x: 20, y: 140, z: 7, width: 610, height: 260,
          config: JSON.stringify({
            name: "Chart_ValidationIssuesByType",
            singleVisual: {
              visualType: "clusteredBarChart",
              projections: {
                Category: [{ queryRef: "fact_validation_issues.issue_type" }],
                Series: [{ queryRef: "fact_validation_issues.severity" }],
                Y: [{ queryRef: "_Measures.Open Issues" }]
              }
            }
          })
        },
        {
          x: 650, y: 140, z: 8, width: 610, height: 260,
          config: JSON.stringify({
            name: "Chart_ResolutionDistribution",
            singleVisual: {
              visualType: "donutChart",
              projections: {
                Category: [{ queryRef: "fact_validation_issues.resolved" }],
                Y: [{ queryRef: "_Measures.Resolved Issues" }]
              }
            }
          })
        },
        {
          x: 20, y: 420, z: 9, width: 1240, height: 280,
          config: JSON.stringify({
            name: "Table_DiscrepancyLog",
            singleVisual: {
              visualType: "tableEx",
              projections: {
                Values: [
                  { queryRef: "fact_validation_issues.id" },
                  { queryRef: "fact_validation_issues.issue_type" },
                  { queryRef: "fact_validation_issues.severity" },
                  { queryRef: "fact_validation_issues.resolved" },
                  { queryRef: "fact_validation_issues.created_at" }
                ]
              }
            }
          })
        }
      ]
    },
    {
      name: "ReportSection_PipelinePerformance",
      displayName: "Page 3 — Pipeline Performance",
      filters: "[]",
      ordinal: 2,
      width: 1280,
      height: 720,
      visualContainers: [
        {
          x: 20, y: 20, z: 1, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_AvgDuration",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Avg Processing Duration (s)" }] }
            }
          })
        },
        {
          x: 230, y: 20, z: 2, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_P50Latency",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.P50 Latency (s)" }] }
            }
          })
        },
        {
          x: 440, y: 20, z: 3, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_P95Latency",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.P95 Latency (s)" }] }
            }
          })
        },
        {
          x: 650, y: 20, z: 4, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_SLACompliance",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.SLA Compliance %" }] }
            }
          })
        },
        {
          x: 860, y: 20, z: 5, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_FailureRate",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Failure Rate %" }] }
            }
          })
        },
        {
          x: 1070, y: 20, z: 6, width: 190, height: 100,
          config: JSON.stringify({
            name: "Card_DocsWithFailures",
            singleVisual: {
              visualType: "card",
              projections: { Values: [{ queryRef: "_Measures.Documents with Failures" }] }
            }
          })
        },
        {
          x: 20, y: 140, z: 7, width: 610, height: 260,
          config: JSON.stringify({
            name: "Chart_LatencyVsFileSize",
            singleVisual: {
              visualType: "lineChart",
              projections: {
                Category: [{ queryRef: "fact_extraction_runs.duration_seconds" }],
                Y: [{ queryRef: "fact_extraction_runs.extracted_count" }],
                Series: [{ queryRef: "fact_extraction_runs.model_name" }]
              }
            }
          })
        },
        {
          x: 650, y: 140, z: 8, width: 610, height: 260,
          config: JSON.stringify({
            name: "Chart_ModelRunOutcomes",
            singleVisual: {
              visualType: "columnChart",
              projections: {
                Category: [{ queryRef: "fact_extraction_runs.model_name" }],
                Y: [{ queryRef: "_Measures.Successful Runs" }, { queryRef: "_Measures.Failed Runs" }]
              }
            }
          })
        },
        {
          x: 20, y: 420, z: 9, width: 1240, height: 280,
          config: JSON.stringify({
            name: "Table_ErrorBreakdown",
            singleVisual: {
              visualType: "tableEx",
              projections: {
                Values: [
                  { queryRef: "fact_extraction_runs.id" },
                  { queryRef: "fact_extraction_runs.document_id" },
                  { queryRef: "fact_extraction_runs.model_name" },
                  { queryRef: "fact_extraction_runs.status" },
                  { queryRef: "fact_extraction_runs.duration_seconds" },
                  { queryRef: "fact_extraction_runs.error_message" }
                ]
              }
            }
          })
        }
      ]
    },
    {
      name: "ReportSection_AnalyticalExplorer",
      displayName: "Page 4 — Analytical Explorer",
      filters: "[]",
      ordinal: 3,
      width: 1280,
      height: 720,
      visualContainers: [
        {
          x: 20, y: 20, z: 1, width: 380, height: 80,
          config: JSON.stringify({
            name: "Slicer_Date",
            singleVisual: {
              visualType: "slicer",
              projections: { Values: [{ queryRef: "dim_calendar.date" }] }
            }
          })
        },
        {
          x: 420, y: 20, z: 2, width: 380, height: 80,
          config: JSON.stringify({
            name: "Slicer_Patient",
            singleVisual: {
              visualType: "slicer",
              projections: { Values: [{ queryRef: "dim_documents.profile_id" }] }
            }
          })
        },
        {
          x: 820, y: 20, z: 3, width: 440, height: 80,
          config: JSON.stringify({
            name: "Slicer_AnalyteCategory",
            singleVisual: {
              visualType: "slicer",
              projections: { Values: [{ queryRef: "dim_analytes.category" }] }
            }
          })
        },
        {
          x: 20, y: 120, z: 4, width: 1240, height: 260,
          config: JSON.stringify({
            name: "Matrix_AnalyteVolumeHierarchy",
            singleVisual: {
              visualType: "pivotTable",
              projections: {
                Rows: [{ queryRef: "dim_analytes.category" }, { queryRef: "dim_analytes.canonical_test_name" }],
                Values: [
                  { queryRef: "_Measures.Total Observations" },
                  { queryRef: "dim_analytes.standard_unit" },
                  { queryRef: "dim_analytes.normal_range_min" },
                  { queryRef: "dim_analytes.normal_range_max" }
                ]
              }
            }
          })
        },
        {
          x: 20, y: 400, z: 5, width: 1240, height: 300,
          config: JSON.stringify({
            name: "Table_LongitudinalDetail",
            singleVisual: {
              visualType: "tableEx",
              projections: {
                Values: [
                  { queryRef: "fact_observations.id" },
                  { queryRef: "fact_observations.observation_date" },
                  { queryRef: "fact_observations.canonical_test_name" },
                  { queryRef: "fact_observations.value_numeric" },
                  { queryRef: "fact_observations.original_unit" },
                  { queryRef: "fact_observations.validation_status" },
                  { queryRef: "fact_observations.verified_by_user" }
                ]
              }
            }
          })
        }
      ]
    }
  ]
};

fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

console.log('Successfully generated PBIP project structure:');
console.log(' - powerbi/VitalTrace_Analytics.pbip');
console.log(' - powerbi/VitalTrace_Analytics.SemanticModel/definition.pbidataset');
console.log(' - powerbi/VitalTrace_Analytics.SemanticModel/model.bim');
console.log(' - powerbi/VitalTrace_Analytics.Report/definition.pbir');
console.log(' - powerbi/VitalTrace_Analytics.Report/report.json');
