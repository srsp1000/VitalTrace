// ====================================================================
// VitalTrace Supabase Edge Function: extract-report
// Server-Side Gemini Extraction Pipeline & Deterministic Validation
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  documentId: string;
}

/**
 * Dynamically resolves the active Google Gemini model ID for the provided API key.
 * Queries Google's ListModels endpoint so that retired/unavailable models (like gemini-1.5-flash)
 * are seamlessly resolved to current supported Flash models (e.g., gemini-2.5-flash, gemini-2.0-flash).
 */
async function resolveActiveGeminiModel(apiKey: string, preferredModel?: string): Promise<string> {
  // If user explicitly configured an alternative modern model in secrets, use it
  if (preferredModel && preferredModel !== "gemini-1.5-flash" && preferredModel !== "gemini-2.5-flash") {
    return preferredModel;
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = listData.models || [];
      
      const retiredModels = new Set([
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-2.5-flash",
      ]);

      const contentModels = models
        .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
        .map(m => m.name.replace(/^models\//, ""))
        .filter(m => !retiredModels.has(m));

      console.log(`[extract-report] Available generateContent models for this API key: ${contentModels.join(", ")}`);

      // Priority preference for fast clinical OCR / multimodal extraction:
      const preferredPriorities = [
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
      ];

      for (const pref of preferredPriorities) {
        if (contentModels.includes(pref)) {
          return pref;
        }
      }

      // Any model containing 'flash'
      const anyFlash = contentModels.find(m => m.includes("flash"));
      if (anyFlash) return anyFlash;

      // Fallback to first available model that supports generateContent
      if (contentModels.length > 0) {
        return contentModels[0];
      }
    } else {
      console.warn(`[extract-report] ListModels returned ${listRes.status}:`, await listRes.text());
    }
  } catch (err) {
    console.warn("[extract-report] Warning querying models.list:", err);
  }

  // Safe fallback if ListModels fails
  return preferredModel || "gemini-3.8-flash";
}

/**
 * Recovers valid observations from an AI response cut off mid-stream by token limits.
 * Scans backwards for the last fully-closed JSON object inside observations, closes
 * the array, and parses the recovered payload.
 */
function tryRepairTruncatedJson(rawText: string): any | null {
  const obsIndex = rawText.indexOf('"observations"');
  if (obsIndex === -1) return null;

  let searchPos = rawText.lastIndexOf("}");
  while (searchPos > obsIndex) {
    const candidateSlice = rawText.substring(0, searchPos + 1);
    const candidateVariants = [
      candidateSlice + "\n]\n}",
      candidateSlice + "\n}",
      candidateSlice + "]}",
    ];

    for (const variant of candidateVariants) {
      try {
        const parsed = JSON.parse(variant);
        if (parsed && Array.isArray(parsed.observations) && parsed.observations.length > 0) {
          console.warn(`[extract-report] Successfully recovered ${parsed.observations.length} observations from truncated output!`);
          return parsed;
        }
      } catch {
        // continue scanning backwards
      }
    }

    searchPos = rawText.lastIndexOf("}", searchPos - 1);
  }

  return null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[extract-report] Request received at ${new Date().toISOString()}`);

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const configuredModel = Deno.env.get("GEMINI_MODEL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // 1. Verify User Authentication via Bearer Token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn("[extract-report] Missing Authorization header");
    return new Response(
      JSON.stringify({ success: false, error: "Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const userToken = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);

  if (authError || !user) {
    console.warn("[extract-report] Unauthorized user token:", authError?.message);
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized user token: " + (authError?.message || "Invalid session") }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[extract-report] Authenticated user: ${user.id}`);

  let documentId: string | null = null;
  let currentRunId: string | null = null;

  try {
    const payload: RequestPayload = await req.json().catch(() => ({ documentId: "" }));
    documentId = payload.documentId;
    if (!documentId) {
      console.warn("[extract-report] Missing documentId parameter in request body");
      return new Response(
        JSON.stringify({ success: false, error: "Missing documentId parameter in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[extract-report] Looking up document: ${documentId}`);

    // 2. Verify Document Ownership
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("profile_id", user.id)
      .single();

    if (docError || !doc) {
      console.error(`[extract-report] Document not found or access denied for ID: ${documentId}`, docError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Document not found or access denied in catalog: " + (docError?.message || "") }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[extract-report] Found document: "${doc.original_filename}" (mime: ${doc.mime_type}, path: ${doc.storage_path})`);

    // 3. Check Gemini API Configuration & Resolve Model
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY secret is not configured in Supabase project secrets. Please run: supabase secrets set GEMINI_API_KEY=your_key");
    }

    const activeModel = await resolveActiveGeminiModel(geminiApiKey, configuredModel);
    console.log(`[extract-report] Using active Gemini model: ${activeModel}`);

    // Update document status to 'processing'
    await supabase
      .from("documents")
      .update({ processing_status: "processing", processing_error: null, updated_at: new Date().toISOString() })
      .eq("id", documentId);

    // Create Extraction Run Record
    const { data: run, error: runInsertError } = await supabase
      .from("extraction_runs")
      .insert({
        document_id: documentId,
        model_name: activeModel,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runInsertError || !run) {
      throw new Error(`Failed to create extraction run record: ${runInsertError?.message}`);
    }

    currentRunId = run.id;
    console.log(`[extract-report] Created extraction run: ${currentRunId}`);

    // 4. Download file from private Storage bucket
    console.log(`[extract-report] Downloading file from storage bucket "medical-documents" at path "${doc.storage_path}"...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("medical-documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to retrieve document from private storage "${doc.storage_path}": ${downloadError?.message}`);
    }

    // Convert file to Base64 using chunking
    const fileBytes = new Uint8Array(await fileData.arrayBuffer());
    console.log(`[extract-report] File downloaded successfully. Size: ${(fileBytes.byteLength / 1024).toFixed(1)} KB`);

    let binary = "";
    const len = fileBytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = fileBytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    const base64Data = btoa(binary);

    // 5. Query Gemini API with Structured Output Schema
    const systemInstruction = `You are an institutional clinical laboratory document parsing engine.
Your task is to exhaustively extract every laboratory test observation and biomarker from the provided medical document.

Strict Extraction Rules:
1. EXHAUSTIVE EXTRACTION: Thoroughly scan EVERY PAGE, panel, and table (e.g. Complete Blood Count, Comprehensive Metabolic Panel, Lipid Profile, Thyroid Panel, Liver Function, Urinalysis, Renal Function). Extract EVERY individual test row. Do NOT skip any test.
2. UNIT EXTRACTION (MANDATORY):
   - You MUST extract the measurement unit for EVERY test row from the "Unit" or "Units" column in the report table (e.g. "mg/dL", "g/dL", "%", "fl", "pg", "/cumm", "uIU/mL", "mm/hr", "mmol/L").
   - NEVER omit the unit. If a calculated index or ratio is dimensionless (e.g. A : G Ratio, BUN/Creatinine Ratio), set unit to "ratio" or "".
3. VALUES:
   - For quantitative tests: extract 'value' as a numeric number (e.g. 95.5, 4.2).
   - For qualitative or non-numeric tests (e.g. "Negative", "Trace", "Reactive", "< 0.05", "Nil"): put the textual value in 'value_text' and set 'value' to null.
4. BIOLOGICAL REFERENCE INTERVALS:
   - Look at the "Reference Interval", "Biological Reference Interval", or "Normal Range" column for each test.
   - If a range like "0.70 - 1.30" or "70 - 99" is given: extract reference_low = 0.70, reference_high = 1.30.
   - If a single upper bound like "< 200" or "< 5.7" is given: extract reference_high = 200, reference_low = null.
   - If a single lower bound like "> 60" is given: extract reference_low = 60, reference_high = null.
   - If no reference interval is given in the table, set both reference_low and reference_high to null.
5. DATES: If an individual test row does not list an observation date, inherit the document or specimen collection date from the header (format YYYY-MM-DD). If no date is found, set observation_date to null.
6. FLAGS: If marked High ('H'), Low ('L'), Abnormal ('A'), or Critical, extract that flag. If normal or unmarked, set reported_flag to null or 'NORMAL'.
7. NO FABRICATION: Extract strictly the data visible in the document.
8. Always set document_type to 'lab_report'.`;

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${geminiApiKey}`;
    console.log(`[extract-report] Calling Gemini API endpoint: ${geminiEndpoint.replace(geminiApiKey, "***")}`);

    // Determine max token capacity (Gemini 3.x models support up to 65536 output tokens)
    const maxTokens = (activeModel.includes("3.8") || activeModel.includes("3.7") || activeModel.includes("3.6") || activeModel.includes("3.5") || activeModel.includes("3.1"))
      ? 65536
      : 8192;

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inline_data: {
                mime_type: doc.mime_type || "application/pdf",
                data: base64Data,
              },
            },
            {
              text: "Carefully inspect every page and table in this medical report. Exhaustively extract all clinical laboratory test results into the structured schema. For each test row, you must transcribe: (1) test_name, (2) numeric value or qualitative value_text, (3) the exact unit from the Unit column, and (4) the biological reference interval bounds (reference_low and reference_high).",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: maxTokens,
        response_mime_type: "application/json",
        response_schema: {
          type: "OBJECT",
          properties: {
            document_type: { 
              type: "STRING", 
              description: "Document type, always 'lab_report'", 
              enum: ["lab_report"] 
            },
            document_date: { type: "STRING", description: "YYYY-MM-DD" },
            patient_name: { type: "STRING" },
            provider_name: { type: "STRING" },
            observations: {
              type: "ARRAY",
              description: "Complete list of all clinical laboratory tests extracted across all pages",
              items: {
                type: "OBJECT",
                properties: {
                  test_name: { type: "STRING", description: "Name of the test or biomarker" },
                  value: { type: "NUMBER", description: "Numeric test result if quantitative, else null" },
                  value_text: { type: "STRING", description: "Textual test result if qualitative or non-numeric, else null" },
                  unit: { type: "STRING", description: "Measurement unit from the Unit column, e.g. mg/dL, g/dL, %, fl, uIU/mL" },
                  reference_low: { type: "NUMBER", description: "Lower reference bound or null" },
                  reference_high: { type: "NUMBER", description: "Upper reference bound or null" },
                  observation_date: { type: "STRING", description: "Observation/collection date in YYYY-MM-DD format" },
                  reported_flag: { type: "STRING", description: "Reported flag: 'H', 'L', 'NORMAL', or null" },
                  page_number: { type: "INTEGER", description: "Page number where test appears" }
                },
                required: ["test_name", "unit"]
              }
            }
          },
          required: ["document_type", "observations"]
        }
      },
    };

    const geminiRes = await fetch(geminiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    console.log(`[extract-report] Gemini API responded with HTTP status ${geminiRes.status}`);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`[extract-report] Gemini API error (${geminiRes.status}):`, errText);
      throw new Error(`Gemini API error (${geminiRes.status}): ${errText}`);
    }

    const geminiJson = await geminiRes.json();
    const candidate = geminiJson.candidates?.[0];
    const candidateText = candidate?.content?.parts?.[0]?.text;
    const finishReason = candidate?.finishReason;

    console.log(`[extract-report] Gemini finishReason: ${finishReason}`);

    if (!candidateText) {
      console.error("[extract-report] Gemini returned empty candidate content:", JSON.stringify(geminiJson));
      throw new Error("Gemini returned empty or invalid content part.");
    }

    // Clean potential markdown wrappers (```json ... ```)
    let cleanJsonText = candidateText.trim();
    if (cleanJsonText.startsWith("```json")) {
      cleanJsonText = cleanJsonText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    } else if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    } else {
      const jsonMatch = cleanJsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanJsonText = jsonMatch[0];
      }
    }

    let parsedExtraction;
    try {
      parsedExtraction = JSON.parse(cleanJsonText);
    } catch (parseErr: unknown) {
      console.warn("[extract-report] Direct JSON.parse failed. Attempting truncation recovery...", parseErr);
      parsedExtraction = tryRepairTruncatedJson(cleanJsonText);
      if (!parsedExtraction) {
        console.error("[extract-report] Failed to parse candidate as JSON. Raw output:", candidateText);
        throw new Error(`Failed to parse Gemini output as JSON: ${parseErr instanceof Error ? parseErr.message : "SyntaxError"}`);
      }
    }

    // Explicitly normalize document_type to 'lab_report'
    if (parsedExtraction) {
      parsedExtraction.document_type = "lab_report";
    }

    // 6. Complete Extraction Run
    const durationMs = Date.now() - startTime;
    const extractedCount = parsedExtraction.observations?.length || 0;
    console.log(`[extract-report] Successfully extracted ${extractedCount} observations in ${durationMs}ms`);
    if (cleanJsonText) {
      console.log(`[extract-report] Model output summary: date=${parsedExtraction.document_date || "null"}, patient=${parsedExtraction.patient_name || "null"}, provider=${parsedExtraction.provider_name || "null"}, obsCount=${extractedCount}`);
    }
    if (extractedCount === 0) {
      console.warn(`[extract-report] NOTE: 0 observations detected in document "${doc.original_filename}". Common reasons: password-protected/encrypted PDF, scanned image without readable text, or non-laboratory document (e.g. invoice/prescription).`);
    }

    await supabase
      .from("extraction_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        extracted_count: extractedCount,
        duration_ms: durationMs,
      })
      .eq("id", currentRunId);

    // Update document status
    await supabase
      .from("documents")
      .update({
        processing_status: extractedCount > 0 ? "review_required" : "completed",
        document_date: parsedExtraction.document_date || doc.document_date,
        extracted_count: extractedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        runId: currentRunId,
        durationMs,
        extraction: parsedExtraction,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal extraction error";
    const durationMs = Date.now() - startTime;

    console.error(`[extract-report ERROR at ${durationMs}ms]:`, errorMsg, err);

    // Log failure in documents table safely using cached documentId
    if (documentId) {
      await supabase
        .from("documents")
        .update({
          processing_status: "failed",
          processing_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    }

    // Mark extraction run as failed if run was created
    if (currentRunId) {
      await supabase
        .from("extraction_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMsg,
          duration_ms: durationMs,
        })
        .eq("id", currentRunId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        durationMs,
        documentId,
        runId: currentRunId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
