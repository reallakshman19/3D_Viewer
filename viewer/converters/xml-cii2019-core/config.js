export function toText(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return fallback;
}

export function migrateXmlCiiSupportConfigJson(rawJson) {
  const text = toText(rawJson).trim();
  if (!text) return text;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return text;
    parsed.supportKindToXmlType = normalizeXmlCiiSupportKindToTypeConfig(parsed.supportKindToXmlType);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export function normalizeXmlCiiSupportKindToTypeConfig(value) {
  const mapping = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  const normalizedGuide = toText(mapping.GUIDE).trim().toUpperCase();
  const normalizedLimit = toText(mapping.LIMIT).trim().toUpperCase();
  const normalizedLinestop = toText(mapping.LINESTOP).trim().toUpperCase();
  if (normalizedGuide === 'X' || normalizedGuide === 'GUIDE') mapping.GUIDE = 'GUI';
  if (normalizedLimit === 'Z' || normalizedLimit === 'LIMIT') mapping.LIMIT = 'LIM';
  if (normalizedLinestop === 'Z' || normalizedLinestop === 'LINESTOP') mapping.LINESTOP = 'LIM';
  return mapping;
}

export function parseXmlCiiEnrichmentConfig(rawJson) {
  const defaults = {
    useFrictionSentinelForNonYSupports: true,
    convertDensityKgM3ToKgCm3: true,
    disableCiiSupportTagPopulation: false,
    duplicateSupportPolicy: 'prefer_datum',
    coordinateTolerance: 1,
    dtxrPositionOffset: { enabled: true, xOffset: 150500, yOffset: 43000, zOffset: 100000, tolerance: 0.5 },
    xmlAxisToCiiAxis: { Z: 'Y' },
    supportKindToXmlType: { REST: '+Y', GUIDE: 'GUI', LINESTOP: 'LIM', LIMIT: 'LIM', ANCHOR: 'A', SPRING: 'Y' },
    defaultXmlSupportType: 'Y',
    defaultStiffness: '1.751270E+12',
    defaultFriction: '0.3',
    linelist: {
      sampleBranchName: '/ASIM-1885-10"-S8810101-91261M7-HC/B1',
      tokenDelimiter: '-',
      lineKeyTokenPositions: '4',
      lineKeyJoiner: '',
      branchNameRegex: '',
      lineNoGroup: 1,
      linelistColumnRegex: '^\\s*(.*?)\\s*$',
      linelistColumnGroup: 1,
    },
    rating: {
      sourceFields: ['RATING', 'PRAT', 'PSPE', 'SPRE', 'LSTU'],
      tokenDelimiter: '-',
      pipingClassTokenIndex: 5,
      pipingClassRegex: '',
      pipingClassGroup: 1,
      ratingSequence: [['200', '20000'], ['150', '15000'], ['100', '10000'], ['25', '2500'], ['15', '1500'], ['5', '5000'], ['1', '150'], ['3', '300'], ['6', '600'], ['9', '900']],
    },
    weight: {
      sourceFields: ['WEIGHT', 'PSIWEIGHT', 'CMPWEIGHTDRY'],
      tokenDelimiter: '-',
      boreTokenIndex: 3,
      boreRegex: '',
      boreGroup: 1,
      inchToMm: 25.4,
      npsToDn: { '0.25': 8, '0.375': 10, '0.5': 15, '0.75': 20, '1': 25, '1.25': 32, '1.5': 40, '2': 50, '2.5': 65, '3': 80, '4': 100, '6': 150, '8': 200, '10': 250, '12': 300, '14': 350, '16': 400, '18': 450, '20': 500, '24': 600 },
      lengthToleranceMm: 4,
      masterLengthUnit: 'auto',
      masterUrl: '../docs/Masters/wtValveweights.json',
      masterRows: [],
    },
    pipingClass: {
      masterUrl: '../docs/Masters/Piping_class_master.json',
      masterRows: [],
      startsWithConfidence: 0.8,
      fuzzyThreshold: 0.6,
      reviewBelow: 1.0,
    },
    material: {
      masterUrl: '../docs/Masters/PCF_MAT_MAP.TXT',
      mapRows: [],
      containsConfidence: 0.9,
      tokenJaccardThreshold: 0.35,
    },
    overrides: { pipingClass: {}, material: {}, rigidWeight: {} },
  };
  const text = toText(rawJson).trim();
  if (!text) return defaults;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
    const supportKindToXmlType = normalizeXmlCiiSupportKindToTypeConfig({
      ...defaults.supportKindToXmlType,
      ...(parsed.supportKindToXmlType || {}),
    });
    return {
      ...defaults,
      ...parsed,
      dtxrPositionOffset: { ...defaults.dtxrPositionOffset, ...(parsed.dtxrPositionOffset || {}) },
      xmlAxisToCiiAxis: { ...defaults.xmlAxisToCiiAxis, ...(parsed.xmlAxisToCiiAxis || {}) },
      supportKindToXmlType,
      linelist: { ...defaults.linelist, ...(parsed.linelist || {}) },
      rating: { ...defaults.rating, ...(parsed.rating || {}) },
      weight: { ...defaults.weight, ...(parsed.weight || {}) },
      pipingClass: { ...defaults.pipingClass, ...(parsed.pipingClass || {}) },
      material: { ...defaults.material, ...(parsed.material || {}) },
      overrides: {
        pipingClass:  { ...(defaults.overrides.pipingClass),  ...((parsed.overrides || {}).pipingClass  || {}) },
        material:     { ...(defaults.overrides.material),     ...((parsed.overrides || {}).material     || {}) },
        rigidWeight:  { ...(defaults.overrides.rigidWeight),  ...((parsed.overrides || {}).rigidWeight  || {}) },
        processData:  { ...((parsed.overrides || {}).processData || {}) },
      },
    };
  } catch {
    return defaults;
  }
}
