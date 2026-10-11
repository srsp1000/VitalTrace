import { type ExtractedReport, ExtractedReportSchema } from './schema';

const STORAGE_KEY_GEMINI = 'vitaltrace_gemini_api_key';

/**
 * Returns the active Gemini API key from environment variables or localStorage.
 */
export function getGeminiApiKey(): string | null {
  const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null);
  const localKey = storage ? storage.getItem(STORAGE_KEY_GEMINI) : null;
  if (localKey && localKey.trim().length > 0) {
    return localKey.trim();
  }
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0 && !envKey.includes('placeholder')) {
    return envKey.trim();
  }
  return null;
}

/**
 * Saves a user-provided Gemini API key to localStorage.
 */
export function setGeminiApiKey(key: string): void {
  const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null);
  if (storage) {
    if (key.trim().length === 0) {
      storage.removeItem(STORAGE_KEY_GEMINI);
    } else {
      storage.setItem(STORAGE_KEY_GEMINI, key.trim());
    }
  }
}

/**
 * Checks whether direct client-side Gemini extraction is configured.
 */
export function isGeminiDirectConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

/**
 * Converts a Uint8Array to a Base64 string using efficient chunking.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Directly extracts structured lab observations from a PDF or image file using Gemini API.
 */
export async function extractLabReportWithDirectGemini(
  file: File,
  docDate?: string,
  onProgress?: (stage: string) => void
): Promise<ExtractedReport> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add VITE_GEMINI_API_KEY in .env or configure in Settings.');
  }

  onProgress?.('Reading document binary stream for multimodal AI extraction...');
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const base64Data = uint8ArrayToBase64(fileBytes);

  onProgress?.('Querying Gemini multimodal model with strict clinical JSON schema...');
  const systemInstruction = `You are an institutional clinical laboratory document parsing engine.
Your task is to exhaustively extract every laboratory test observation and biomarker from the provided medical document.

Strict Rules:
1. EXHAUSTIVE EXTRACTION: Thoroughly scan EVERY PAGE, panel, and table. Extract EVERY individual test row.
2. UNIT EXTRACTION (MANDATORY): You MUST transcribe the measurement unit for EVERY test row from the "Unit" or "Units" column (e.g. mg/dL, g/dL, %, fl, uIU/mL). Never omit the unit. For dimensionless ratios, set unit to "ratio" or "".
3. BIOLOGICAL REFERENCE INTERVALS: Transcribe numeric reference_low and reference_high from the Reference Interval column. If a single bound like "< 200", set reference_high: 200, reference_low: null.
4. DATES: Inherit collection/report date from the header if not listed per row.
5. NEVER fabricate values or biomarkers. Always set document_type to 'lab_report'.`;

  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemInstruction },
          {
            inline_data: {
              mime_type: file.type || 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: "Extract all clinical tests with test_name, value, unit from the Unit column, and reference intervals."
          }
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
      response_schema: {
        type: 'OBJECT',
        properties: {
          document_type: { type: 'STRING', enum: ['lab_report'] },
          document_date: { type: 'STRING', description: 'YYYY-MM-DD' },
          patient_name: { type: 'STRING' },
          provider_name: { type: 'STRING' },
          observations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                test_name: { type: 'STRING' },
                value: { type: 'NUMBER' },
                value_text: { type: 'STRING' },
                unit: { type: 'STRING' },
                reference_low: { type: 'NUMBER' },
                reference_high: { type: 'NUMBER' },
                observation_date: { type: 'STRING' },
                reported_flag: { type: 'STRING' },
                page_number: { type: 'INTEGER' },
              },
              required: ['test_name', 'unit'],
            },
          },
        },
        required: ['document_type', 'observations'],
      },
    },
  };

  const response = await fetch(geminiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

  onProgress?.('Verifying extracted observations against clinical schema...');
  const rawParsed = JSON.parse(textContent);

  // Fallback date if model didn't detect document date
  if (!rawParsed.document_date && docDate) {
    rawParsed.document_date = docDate;
  }

  return ExtractedReportSchema.parse(rawParsed);
}
