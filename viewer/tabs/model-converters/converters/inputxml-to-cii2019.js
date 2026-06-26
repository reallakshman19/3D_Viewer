import { decodeTextUtf8 } from '../core/output-utils.js';

const INPUTXML_HEADER_DEFAULTS = Object.freeze({
  headerDateTime: '13:40:45 6 May 2026',
  headerSource: 'AVEVA PSI',
  headerVersion: '3.1.7.0 (psi2cii.exe version 3.1.0.3 (Feb 21 2024))',
  headerUserName: 'MUCE828',
  headerPurpose: 'Preliminary stress run',
  headerProjectName: 'ZAU',
  headerMdbName: '/ZAU1',
});

const INPUTXML2019_SAFE_UNITS = Object.freeze({
  numeric_lines: Object.freeze([
    '        25.4000      4.44822     0.453592     0.112985     0.112985      6.89476',
    '       0.555556     -17.7778      6.89476      6.89476 2.768000E-02 2.768000E-02',
    '   2.768000E-02      1.75127     0.112985      1.75127      1.00000      6.89476',
    '   2.540000E-02      25.4000      25.4000      25.4000',
  ]),
  text_lines: Object.freeze([
    '  SI (mm)        ',
    '  on ',
    '  mm.',
    '  N. ',
    '  Kg.',
    '  N.m.  ',
    '  N.m.. ',
    '  KPa       ',
    '  C',
    '  C',
    '  KPa       ',
    '  KPa       ',
    '  kg.cu.cm. ',
    '  kg.cu.cm. ',
    '  kg.cu.cm. ',
    '  N./cm. ',
    '  N.m./deg  ',
    '  N./cm. ',
    "  g's",
    '  Kpa       ',
    '  m. ',
    '  mm.',
    '  mm.',
    '  mm.',
  ]),
});

const INPUTXML2019_POPUP_HEADER_KEYS = Object.freeze([
  'headerDateTime',
  'headerSource',
  'headerVersion',
  'headerUserName',
  'headerPurpose',
  'headerProjectName',
  'headerMdbName',
]);

const INPUTXML2019_HEADER_LABELS = Object.freeze({
  headerDateTime: 'Header DateTime',
  headerSource: 'Header Source',
  headerVersion: 'Header Version',
  headerUserName: 'Header UserName',
  headerPurpose: 'Header Purpose',
  headerProjectName: 'Header ProjectName',
  headerMdbName: 'Header MDBName',
});

function defaultInputxml2019LayoutConfigJson() {
  return JSON.stringify({
    elements: {
      row3: ['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000'],
      row4: ['10.0000', '30.0000', '0.000000', '0.000000', '0.000000', '0.000000'],
      row5: ['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000'],
      row6: ['0.499901E-04', '0.965312E-03', '0.000000', '0.000000', '0.000000', '15.0000'],
      row7: ['0.000000', '0.000000', '0.000000', '0.000000', '0.000000', '0.000000'],
      row8: ['0.000000', '0.000000', '0.000000', '0.000000', '9999.99', '9999.99'],
      row9: ['0.000000', '0.000000', '0.000000', '0.000000', '0.000000'],
      row10: ['0'],
      row12: ['{bend}', '{rigid}', '0', '{restraint}', '{sif}', '0'],
      row13: ['0', '0', '0', '{sif}', '0', '0'],
      row14: ['{reducer}', '0', '{sif}'],
      line_label: {
        pointer_start: 0,
        label_index_start: 1,
        label_prefix: 'LINENO',
        label_width: 1,
        default_line: '0',
        line_labels: [],
      },
    },
    nodename: {
      nonam_count: 0,
      from_label: 'PS-XXX',
      to_label: 'PS-XXX',
      from_labels: [],
      to_labels: [],
    },
    control: {
      line1: ['{elements}', '{nozzles}', '{hangers}', '{nonam}', '{reducers}', '{flanges}'],
      line2: ['{bends}', '{rigids}', '{expjts}', '{restraints}', '{displmnt}', '{forcmnt}'],
      line3: ['{uniform}', '{wind}', '{offsets}', '{allowbls}', '{sifs}', '0'],
      line4: ['{equipmnt}'],
    },
    sections: {
      include_nodename: false,
    },
    miscel_1: {
      material_id_default: '0.000',
      material_ids: [],
    },
    units: {
      numeric_lines: [...INPUTXML2019_SAFE_UNITS.numeric_lines],
      text_lines: [...INPUTXML2019_SAFE_UNITS.text_lines],
    },
  }, null, 2);
}

function stripXmlTags(value) {
  return String(value || '').replace(/<[^>]+>/g, '').trim();
}

export function detectInputxml2019SourceKind(xmlText) {
  const source = String(xmlText || '').trim();
  if (!source) return 'EMPTY';
  if (/<PIPINGELEMENT\b/i.test(source)) return 'CAESARII_INPUTXML';
  if (/<Branch\b[\s\S]*?<Node\b/i.test(source)) return 'XML_CII_BRANCH_NODE';
  if (/<EnrichedInputXml\b|<UXML\b/i.test(source)) return 'UXML_OR_ENRICHED_INPUTXML';
  if (/<CAESARII\b/i.test(source)) return 'CAESARII_WITHOUT_PIPINGELEMENT';
  return 'UNKNOWN_XML';
}

function inputKindError(kind) {
  if (kind === 'XML_CII_BRANCH_NODE') {
    return 'Selected XML is PSI/XML-CII Branch/Node XML, not CAESARII InputXML. Use converter "XML->CII(2019)" for this file, or select a CAESARII InputXML file that contains PIPINGELEMENT rows.';
  }
  if (kind === 'UXML_OR_ENRICHED_INPUTXML') {
    return 'Selected XML is UXML/enriched InputXML, not CAESARII InputXML. This route is not a direct InputXML->CII(2019) worker input yet; use the UXML import/projection workflow when enabled.';
  }
  if (kind === 'CAESARII_WITHOUT_PIPINGELEMENT') {
    return 'Selected CAESARII XML has no PIPINGELEMENT rows. Cannot derive InputXML->CII(2019) file-based requirements.';
  }
  if (kind === 'EMPTY') return 'Selected XML file is empty.';
  return 'Selected XML is not recognised as CAESARII InputXML. InputXML->CII(2019) requires PIPINGELEMENT rows.';
}

function parseInputxml2019Requirements(xmlText) {
  const sourceKind = detectInputxml2019SourceKind(xmlText);
  if (sourceKind !== 'CAESARII_INPUTXML') throw new Error(inputKindError(sourceKind));
  if (typeof DOMParser === 'undefined') {
    const elementCount = (String(xmlText || '').match(/<PIPINGELEMENT\b/gi) || []).length;
    if (!elementCount) throw new Error(inputKindError(sourceKind));
    const bendCount = (String(xmlText || '').match(/<BEND\b/gi) || []).length;
    const rigidCount = (String(xmlText || '').match(/<RIGID\b/gi) || []).length;
    const restraintCount = (String(xmlText || '').match(/<RESTRAINT\b/gi) || []).length;
    const sifCount = (String(xmlText || '').match(/<SIF\b/gi) || []).length;
    const nodeIds = new Set();
    for (const match of String(xmlText || '').matchAll(/\b(?:FROM_NODE|TO_NODE)\s*=\s*"([^"]*)"/gi)) {
      const value = Number(stripXmlTags(match[1]));
      if (Number.isFinite(value)) nodeIds.add(value);
    }
    return { elementCount, bendCount, rigidCount, restraintCount, sifCount, nodeCount: nodeIds.size };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(xmlText || ''), 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Input XML parse failed. Cannot derive file-specific config requirements.');
  }

  const elements = Array.from(doc.getElementsByTagName('PIPINGELEMENT'));
  if (!elements.length) {
    throw new Error(inputKindError(detectInputxml2019SourceKind(xmlText)));
  }

  let bendCount = 0;
  let rigidCount = 0;
  let restraintCount = 0;
  let sifCount = 0;
  const nodeIds = new Set();

  for (const element of elements) {
    bendCount += element.getElementsByTagName('BEND').length;
    rigidCount += element.getElementsByTagName('RIGID').length;
    restraintCount += element.getElementsByTagName('RESTRAINT').length;
    sifCount += element.getElementsByTagName('SIF').length;

    const fromNode = Number(element.getAttribute('FROM_NODE'));
    const toNode = Number(element.getAttribute('TO_NODE'));
    if (Number.isFinite(fromNode)) nodeIds.add(fromNode);
    if (Number.isFinite(toNode)) nodeIds.add(toNode);
  }

  return {
    elementCount: elements.length,
    bendCount,
    rigidCount,
    restraintCount,
    sifCount,
    nodeCount: nodeIds.size,
  };
}

function parseInputxml2019ConfigOrDefault(layoutConfigJsonText) {
  const source = String(layoutConfigJsonText || '').trim();
  if (!source) return { config: JSON.parse(defaultInputxml2019LayoutConfigJson()), parseIssue: null };
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        config: JSON.parse(defaultInputxml2019LayoutConfigJson()),
        parseIssue: 'Existing config is not a JSON object. Replaced with default profile.',
      };
    }
    return { config: parsed, parseIssue: null };
  } catch {
    return {
      config: JSON.parse(defaultInputxml2019LayoutConfigJson()),
      parseIssue: 'Existing config is invalid JSON. Replaced with default profile.',
    };
  }
}

function numbersFromCiiRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .flatMap((row) => String(row ?? '').trim().split(/\s+/).filter(Boolean))
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
}

function applyInputxml2019SafeUnits(config, notes) {
  if (!config.units || typeof config.units !== 'object' || Array.isArray(config.units)) {
    config.units = {};
  }
  const numericValues = numbersFromCiiRows(config.units.numeric_lines);
  const numericIsUnsafe = numericValues.length === 0
    || numericValues.every((value) => Math.abs(value) < 1e-12);
  const textIsIncomplete = !Array.isArray(config.units.text_lines)
    || config.units.text_lines.length !== INPUTXML2019_SAFE_UNITS.text_lines.length;

  if (numericIsUnsafe) {
    config.units.numeric_lines = [...INPUTXML2019_SAFE_UNITS.numeric_lines];
    notes.push('Replaced unsafe all-zero units.numeric_lines with CAESAR-safe metric conversion constants.');
  }
  if (textIsIncomplete) {
    config.units.text_lines = [...INPUTXML2019_SAFE_UNITS.text_lines];
    notes.push('Set units.text_lines to the CAESAR 2019 metric label block.');
  }
}

function sameTextArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => String(v).trim() === String(b[i]).trim());
}

export function prepareInputxml2019ConfigForRequirements(layoutConfigJsonText, requirements) {
  const { config, parseIssue } = parseInputxml2019ConfigOrDefault(layoutConfigJsonText);
  const notes = [];
  if (parseIssue) notes.push(parseIssue);

  applyInputxml2019SafeUnits(config, notes);

  if (!config.compatibility || typeof config.compatibility !== 'object' || Array.isArray(config.compatibility)) {
    config.compatibility = {};
  }
  if (!config.compatibility.raw_override_mode) {
    config.compatibility.raw_override_mode = 'schema_validated';
    notes.push('Set compatibility.raw_override_mode to schema_validated for robust file-based generation.');
  }

  if (!config.control || typeof config.control !== 'object' || Array.isArray(config.control)) {
    config.control = {};
  }
  const dynamicControl = {
    line1: ['{elements}', '{nozzles}', '{hangers}', '{nonam}', '{reducers}', '{flanges}'],
    line2: ['{bends}', '{rigids}', '{expjts}', '{restraints}', '{displmnt}', '{forcmnt}'],
    line3: ['{uniform}', '{wind}', '{offsets}', '{allowbls}', '{sifs}', '0'],
    line4: ['{equipmnt}'],
  };
  const legacyControl = {
    line1: ['{elements}', '0', '3', '0', '3', '0'],
    line2: ['{bends}', '{rigids}', '0', '{restraints}', '3', '0'],
    line3: ['0', '0', '0', '1', '{sifs}', '0'],
    line4: ['4'],
  };
  for (const key of Object.keys(dynamicControl)) {
    if (!Array.isArray(config.control[key]) || sameTextArray(config.control[key], legacyControl[key])) {
      config.control[key] = dynamicControl[key];
      notes.push(`Set control.${key} to emitted-section-derived counters.`);
    }
  }

  if (!config.elements || typeof config.elements !== 'object' || Array.isArray(config.elements)) {
    config.elements = {};
  }
  if (!config.elements.line_label || typeof config.elements.line_label !== 'object' || Array.isArray(config.elements.line_label)) {
    config.elements.line_label = {};
  }
  if (!Array.isArray(config.elements.line_label.line_labels)) {
    config.elements.line_label.line_labels = [];
  }
  if (sameTextArray(config.elements.line_label.line_labels, ['10 unassigned'])) {
    config.elements.line_label.line_labels = [];
    notes.push('Cleared legacy default line label override; auto mode now emits zero line-number rows unless configured per file.');
  }
  const lineLabelsCount = config.elements.line_label.line_labels.length;

  if (Array.isArray(config.elements.raw_block_overrides) && config.elements.raw_block_overrides.length > 0) {
    if (config.elements.raw_block_overrides.length !== requirements.elementCount) {
      notes.push(
        `Cleared elements.raw_block_overrides (${config.elements.raw_block_overrides.length}) because file has ${requirements.elementCount} elements.`,
      );
      delete config.elements.raw_block_overrides;
    }
  }

  if (!config.sections || typeof config.sections !== 'object' || Array.isArray(config.sections)) {
    config.sections = {};
  }
  if (config.sections.raw_payload_overrides && typeof config.sections.raw_payload_overrides === 'object' && !Array.isArray(config.sections.raw_payload_overrides)) {
    const rawElements = config.sections.raw_payload_overrides.ELEMENTS;
    if (Array.isArray(rawElements)) {
      const expectedElementLines = requirements.elementCount * 15;
      if (rawElements.length !== expectedElementLines) {
        notes.push(
          `Cleared sections.raw_payload_overrides because ELEMENTS payload length (${rawElements.length}) does not match required ${expectedElementLines}.`,
        );
        delete config.sections.raw_payload_overrides;
      }
    }
  }

  if (!config.miscel_1 || typeof config.miscel_1 !== 'object' || Array.isArray(config.miscel_1)) {
    config.miscel_1 = {};
  }
  if (!Array.isArray(config.miscel_1.material_ids)) {
    config.miscel_1.material_ids = [];
  }
  const materialIdsCount = config.miscel_1.material_ids.length;

  const requirementLines = [
    `Detected from selected XML: ${requirements.elementCount} elements, ${requirements.bendCount} bends, ${requirements.rigidCount} rigids, ${requirements.restraintCount} restraints, ${requirements.sifCount} SIF blocks, ${requirements.nodeCount} nodes.`,
    `Element-wise configurable lengths: elements.line_label.line_labels=${requirements.elementCount}, miscel_1.material_ids=${requirements.elementCount}.`,
    `Current config lengths: line_labels=${lineLabelsCount}, material_ids=${materialIdsCount}.`,
  ];
  for (const note of notes) requirementLines.push(note);

  return {
    jsonText: JSON.stringify(config, null, 2),
    requirementLines,
  };
}

export function inputxml2019PopupHeaderFields(def, values = {}) {
  const fields = Array.isArray(def?.options)
    ? def.options
    : (Array.isArray(def?.fields) ? def.fields : []);
  const sourceFields = fields.length
    ? fields
    : INPUTXML2019_POPUP_HEADER_KEYS.map((key) => ({ key, label: INPUTXML2019_HEADER_LABELS[key] || key, type: 'text' }));
  return sourceFields
    .filter((entry) => entry && INPUTXML2019_POPUP_HEADER_KEYS.includes(entry.key))
    .map((entry) => ({
      ...entry,
      value: values[entry.key],
    }));
}

export async function openInputxml2019PreRunPopup(def, values, primaryFileName, primaryBytes, openJsonPopupAsync) {
  if (typeof openJsonPopupAsync !== 'function') throw new Error('InputXML->CII(2019) config popup callback is not available.');
  const safeDef = def && typeof def === 'object' && !Array.isArray(def) ? def : {};
  const safeValues = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const xmlText = decodeTextUtf8(primaryBytes);
  const requirements = parseInputxml2019Requirements(xmlText);
  const prepared = prepareInputxml2019ConfigForRequirements(safeValues.layoutConfigJson, requirements);
  const popupHeaderFields = inputxml2019PopupHeaderFields(safeDef, safeValues);

  const popupResult = await openJsonPopupAsync({
    title: `${safeDef.label || 'InputXML->CII(2019)'}: File-based Config Review (${String(primaryFileName || '')})`,
    value: prepared.jsonText,
    headerFields: popupHeaderFields,
    requirementLines: prepared.requirementLines,
  });

  if (!popupResult?.saved || !popupResult.payload) return false;
  const { jsonText, headerValues } = popupResult.payload;
  safeValues.layoutConfigJson = prepareInputxml2019ConfigForRequirements(jsonText, requirements).jsonText;
  for (const [headerKey, headerValue] of Object.entries(headerValues || {})) {
    safeValues[headerKey] = headerValue;
  }
  return true;
}

export async function run(context = {}) {
  if (!context.workerRunner) {
    throw new Error('Python worker runtime is not available.');
  }
  const inputFiles = Array.isArray(context.inputFiles) ? context.inputFiles : [];
  const primary = inputFiles.find((f) => f?.role === 'primary') || inputFiles[0] || null;
  if (!primary || !primary.bytes) {
    throw new Error('Primary input file is required for InputXML->CII(2019).');
  }

  const runValues = context.options && typeof context.options === 'object' && !Array.isArray(context.options) ? context.options : {};

  if (typeof runValues.openInputxml2019PreRunPopup === 'function' && typeof runValues.openJsonPopupAsync === 'function') {
    const converterDef = context.converterDefinition || context.converterDef || context.converter || { id: context.converterId, label: 'InputXML->CII(2019)' };
    const proceed = await runValues.openInputxml2019PreRunPopup(
      converterDef,
      runValues,
      primary.name,
      primary.bytes,
      runValues.openJsonPopupAsync,
    );
    if (!proceed) {
      throw new Error('Cancelled: conversion aborted in file-based config popup.');
    }
  }

  return await context.workerRunner.runJob({
    converterId: context.converterId,
    inputFiles,
    options: runValues,
  });
}
