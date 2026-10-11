/**
 * Transparent Clinical Alias Dictionary & LOINC Mapper
 * Maps diverse laboratory transcription labels to standard canonical test names and verified LOINC codes.
 */

export interface CanonicalTestDefinition {
  canonicalName: string;
  loincCode: string | null;
  standardUnit: string;
  aliases: string[];
  expectedUnits: string[];
}

export const CANONICAL_TEST_DEFINITIONS: CanonicalTestDefinition[] = [
  {
    canonicalName: 'Fasting Glucose',
    loincCode: '1558-6',
    standardUnit: 'mg/dL',
    expectedUnits: ['mg/dL', 'mmol/L', 'mg/dl'],
    aliases: [
      'fasting glucose',
      'glucose, fasting',
      'glucose fasting',
      'glucose, fasting (serum)',
      'fasting blood glucose',
      'fbg',
      'fbs',
      'fasting blood sugar',
      'blood sugar fasting',
      'glucose, fasting, plasma',
      'glucose (spot)',
      'glucose',
      'serum glucose',
    ],
  },
  {
    canonicalName: 'HbA1c',
    loincCode: '4548-4',
    standardUnit: '%',
    expectedUnits: ['%', 'percent', 'mmol/mol'],
    aliases: [
      'hba1c',
      'hemoglobin a1c',
      'hemoglobin a1c (ngsp)',
      'glycated hemoglobin',
      'a1c',
      'hgb a1c',
      'glycohemoglobin',
    ],
  },
  {
    canonicalName: 'Hemoglobin',
    loincCode: '718-7',
    standardUnit: 'g/dL',
    expectedUnits: ['g/dL', 'g/dl', 'g/L'],
    aliases: [
      'hemoglobin',
      'hgb',
      'hemoglobin (hgb)',
      'blood hemoglobin',
      'total hemoglobin',
    ],
  },
  {
    canonicalName: 'White Blood Cell Count',
    loincCode: '6690-2',
    standardUnit: 'x10^3/uL',
    expectedUnits: ['x10^3/uL', 'x10^3/ul', '10*3/uL', 'K/uL', 'thou/uL', '/uL'],
    aliases: [
      'wbc',
      'white blood cells',
      'white blood count',
      'leukocytes',
      'wbc count',
      'white blood cell count',
    ],
  },
  {
    canonicalName: 'Platelet Count',
    loincCode: '777-3',
    standardUnit: 'x10^3/uL',
    expectedUnits: ['x10^3/uL', 'x10^3/ul', '10*3/uL', 'K/uL', 'thou/uL'],
    aliases: [
      'platelet count',
      'platelets',
      'plt',
      'platelet count (plt)',
      'platelets (automated count)',
    ],
  },
  {
    canonicalName: 'Creatinine',
    loincCode: '2160-0',
    standardUnit: 'mg/dL',
    expectedUnits: ['mg/dL', 'mg/dl', 'umol/L'],
    aliases: [
      'creatinine',
      'creatinine, serum',
      'serum creatinine',
      'creat',
    ],
  },
  {
    canonicalName: 'Total Cholesterol',
    loincCode: '2093-3',
    standardUnit: 'mg/dL',
    expectedUnits: ['mg/dL', 'mg/dl', 'mmol/L'],
    aliases: [
      'total cholesterol',
      'cholesterol, total',
      'cholesterol',
      'total cholest',
      'cholesterol, total (duplicate entry)',
    ],
  },
  {
    canonicalName: 'LDL Cholesterol',
    loincCode: '13457-7',
    standardUnit: 'mg/dL',
    expectedUnits: ['mg/dL', 'mg/dl', 'mmol/L'],
    aliases: [
      'ldl cholesterol',
      'ldl calculated',
      'ldl-c',
      'ldl cholesterol direct',
      'cholesterol, ldl calculated',
      'low density lipoprotein',
    ],
  },
  {
    canonicalName: 'HDL Cholesterol',
    loincCode: '2085-9',
    standardUnit: 'mg/dL',
    expectedUnits: ['mg/dL', 'mg/dl', 'mmol/L'],
    aliases: [
      'hdl cholesterol',
      'hdl-c',
      'hdl',
      'cholesterol, hdl',
      'high density lipoprotein',
    ],
  },
  {
    canonicalName: 'Triglycerides',
    loincCode: '2571-8',
    standardUnit: 'mg/dL',
    expectedUnits: ['mg/dL', 'mg/dl', 'mmol/L'],
    aliases: [
      'triglycerides',
      'triglycerides, serum',
      'trig',
      'trigs',
    ],
  },
  {
    canonicalName: 'TSH',
    loincCode: '3016-3',
    standardUnit: 'mIU/L',
    expectedUnits: ['mIU/L', 'uIU/mL', 'uIU/ml', 'mIU/l'],
    aliases: [
      'tsh',
      'thyroid stimulating hormone',
      'tsh (thyroid stimulating hormone)',
      'thyrotropin',
      'tsh, ultrasensitive',
    ],
  },
];

/**
 * Maps raw transcribed test names to standard canonical names and LOINC codes.
 * Uncertain or unmapped tests remain unmapped rather than fabricating a false LOINC.
 */
export function canonicalizeTestName(rawTestName: string): {
  canonicalName: string;
  loincCode: string | null;
  standardUnit: string | null;
  isMapped: boolean;
} {
  const normalized = rawTestName.trim().toLowerCase();

  // Phase 1: Exact matches against canonical names
  for (const def of CANONICAL_TEST_DEFINITIONS) {
    if (def.canonicalName.toLowerCase() === normalized) {
      return {
        canonicalName: def.canonicalName,
        loincCode: def.loincCode,
        standardUnit: def.standardUnit,
        isMapped: true,
      };
    }
  }

  // Phase 2: Exact matches against aliases
  for (const def of CANONICAL_TEST_DEFINITIONS) {
    for (const alias of def.aliases) {
      if (normalized === alias) {
        return {
          canonicalName: def.canonicalName,
          loincCode: def.loincCode,
          standardUnit: def.standardUnit,
          isMapped: true,
        };
      }
    }
  }

  // Phase 3: Substring matches, prioritizing longer and more specific aliases
  const aliasCandidates: { def: CanonicalTestDefinition; alias: string }[] = [];
  for (const def of CANONICAL_TEST_DEFINITIONS) {
    for (const alias of def.aliases) {
      if (normalized.includes(alias)) {
        // Disambiguate generic "cholesterol": do not match Total Cholesterol if HDL or LDL is specified
        if (alias === 'cholesterol' && (normalized.includes('hdl') || normalized.includes('ldl'))) {
          continue;
        }
        aliasCandidates.push({ def, alias });
      }
    }
  }

  // Sort candidate matches by alias length descending (longest / most specific match first)
  aliasCandidates.sort((a, b) => b.alias.length - a.alias.length);

  if (aliasCandidates.length > 0) {
    const bestMatch = aliasCandidates[0].def;
    return {
      canonicalName: bestMatch.canonicalName,
      loincCode: bestMatch.loincCode,
      standardUnit: bestMatch.standardUnit,
      isMapped: true,
    };
  }

  // Uncertain / unmapped: preserve raw name, leave LOINC null
  return {
    canonicalName: rawTestName.trim(),
    loincCode: null,
    standardUnit: null,
    isMapped: false,
  };
}

/**
 * Unambiguous unit standardizer.
 * Only standardizes exact uppercase/lowercase or standard spelling variations without guesswork.
 */
export function normalizeUnit(rawUnit: string | null | undefined): string | null {
  if (!rawUnit || rawUnit.trim() === '') return null;
  const trimmed = rawUnit.trim();

  // Common unit normalizations
  const unitMap: Record<string, string> = {
    'mg/dl': 'mg/dL',
    'mg/dL': 'mg/dL',
    'g/dl': 'g/dL',
    'g/dL': 'g/dL',
    'miu/l': 'mIU/L',
    'miu/L': 'mIU/L',
    'mIU/L': 'mIU/L',
    'uiu/ml': 'uIU/mL',
    'uIU/mL': 'uIU/mL',
    'x10^3/ul': 'x10^3/uL',
    'x10^3/uL': 'x10^3/uL',
    'k/ul': 'x10^3/uL',
    'K/uL': 'x10^3/uL',
    '%': '%',
    'percent': '%',
    'mmol/l': 'mmol/L',
    'mmol/L': 'mmol/L',
  };

  return unitMap[trimmed.toLowerCase()] || trimmed;
}
