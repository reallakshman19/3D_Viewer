import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) { return readFileSync(path.join(root, rel), 'utf8'); }

const runner = read('viewer/tabs/model-converters/converters/xmltocii2019_runner.js');
const parity = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js');
const preview = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js');
const table = read('viewer/tabs/model-converters/shared/EditablePreviewTable.js');
const base = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js');
const config = read('viewer/converters/xml-cii2019-core/config.js');
const directionWorker = read('viewer/converters/scripts/xml_to_cii2019_direction.py');
const inputXmlDebug = read('viewer/converters/scripts/xml_to_inputxml_debug.py');
const baseWorker = read('viewer/converters/scripts/xml_to_cii2019.py');

const mappedProcessFixture = Object.freeze({
  branchName: '/ASIM-1835-4"-P8810212-31441C4-PP/B1',
  lineKey: 'P8810212',
  fieldMap: Object.freeze({ lineKey2: 'Line number', p1: 'Design Pressure', hydroPressure: 'Hydro Test Pressure', t1: 'Design Temp', t2: 'T2', t3: 'T3', densityMixed: 'Density Mixed', phase: 'Phase' }),
  expectedEnrichedXml: Object.freeze({ Pressure1: '3210', HydroPressure: '4815', Temperature1: '205', Temperature2: '180', Temperature3: '-29', FluidDensity: '845' }),
});

assert.ok(runner.includes('./xmltocii2019_helper/enrichment-run-parity.js'), 'XML->CII run must use the preview/run parity enrichment helper.');
assert.ok(parity.includes("import { xmlCiiDryRunPreview }"), 'Parity helper must reuse the same dry-run preview resolver used by phase 3.');
assert.ok(preview.includes('normalizeLineListRow(match.row') && preview.includes('config.linelist?.fieldMap'), 'Preview must normalize matched line-list rows through the active field map before reading process values.');
assert.ok(preview.includes('_xmlCiiProcessValue') && preview.includes('hydroPressure') && preview.includes('resolveLineListDensity'), 'Preview must resolve mapped P1/Hydro/T1/T2/T3/density values through the shared process path.');
assert.ok(table.includes("{ id: 'hydroPressure', label: 'Hydro/Test Pressure'") && table.includes("{ id: 'p1', label: 'P1 / Design Pressure'"), 'Preview table must expose Hydro/Test Pressure and must not mislabel P1 as MPa.');
assert.ok(parity.includes("setText(document, pressure, 'Pressure1'") && parity.includes("rowValue(row, 'p1'"), 'Parity helper must write preview P1 into enriched XML Pressure1.');
assert.ok(parity.includes("setText(document, pressure, 'HydroPressure'") && parity.includes('hydroPressure'), 'Parity helper must write mapped Hydro/Test Pressure into enriched XML HydroPressure.');
assert.ok(parity.includes("setText(document, temperature, 'Temperature1'") && parity.includes("setText(document, temperature, 'Temperature2'") && parity.includes("setText(document, temperature, 'Temperature3'"), 'Parity helper must write preview T1/T2/T3 into enriched XML Temperature1/2/3.');
assert.ok(parity.includes("setText(document, branch, 'FluidDensity'") && parity.includes("rowValue(row, 'density'"), 'Parity helper must write resolved mapped density into enriched XML FluidDensity.');
assert.ok(parity.includes('process-provenance') && parity.includes('Hydro/Test Pressure') && parity.includes('lineListRowFound') && parity.includes('sourceRowIndex') && parity.includes('final='), 'Diagnostics must expose visible process provenance for each mapped/default process value.');
assert.ok(parity.includes('dropGasketNodesFromXmlText') && parity.includes('dropGasketNodesFromDocument'), 'Parity helper must remove GASK node blocks before base enrichment and before split logic.');
assert.ok(parity.includes("RENUMBERABLE_NEGATIVE_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST'])"), 'Resolved condense must exclude GASK from renumberable negative inline blocks.');
assert.ok(parity.includes("INLINE_LENGTH_COMPONENT_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST'])"), 'ElementLengthMm calculation must exclude GASK after default gasket drop.');
assert.ok(parity.includes('sameComponentRefMate') && parity.includes('allocateContiguousNumbers') && parity.includes('condensedValveFlangeBlocks'), 'Resolved condense must detect contiguous negative component chains and assign stable positive ordered node numbers.');
assert.ok(parity.includes("setTextAfter(document, node, 'Rigid', '2', 'Endpoint')"), 'Resolved inline FLAN/VALV/RIGID/INST components must emit Rigid=2 after Endpoint.');
assert.ok(parity.includes('RESOLVED_FLEXIBLE_MARKER_TYPES = new Set([])') && !parity.includes('GASK: \'1\''), 'GASK is dropped and must not be preserved as a non-rigid split marker.');
assert.ok(parity.includes('element-length-inline-negative') && parity.includes('instElementLengthAnnotations'), 'Negative INST and inline chain ElementLengthMm diagnostics must exist.');
assert.ok(parity.includes('DTXR_POS_SIF_ZERO_TYPES') && parity.includes("setText(document, node, 'SIF', '0')") && parity.includes('dtxr-pos-sif-zero') && parity.includes('TEEDESC_POS') && parity.includes('OLET'), 'DTXR_POS-matched Tee/Olet nodes must be assigned SIF=0 before final CII worker conversion.');
assert.ok(config.includes('BRANCH\\s+OUTLET') && directionWorker.includes('BRANCH\\s+OUTLET') && directionWorker.includes('OLET\\b.*\\bBW') && inputXmlDebug.includes('BRANCH\\s+OUTLET') && inputXmlDebug.includes('return 5'), 'Branch Outlet BW OLET descriptions must map to CII SIF&TEES type 5, not type 0.');
assert.ok(config.includes('TEE\\b.*\\bB\\s*\\.?\\s*W\\.?\\b') && directionWorker.includes('TEE\\b.*\\bB\\s*\\.?\\s*W\\.?\\b') && directionWorker.includes('BUTTWELD') && inputXmlDebug.includes('TEE\\b.*\\bB\\s*\\.?\\s*W\\.?\\b') && inputXmlDebug.includes('return 3'), 'TEE BW/Buttweld descriptions must map to CII SIF&TEES type 3 in browser config, CII worker, and InputXML debug export.');
assert.ok(baseWorker.includes('second_thickness = edge.to_node.wall_thickness') && !baseWorker.includes("_format_fixed_float(0.0, 6),\n                    _format_fixed_float(alpha_angle"), 'Reducer REDUCERS payload must write second thickness from reducer/adjacent wall data, not hard-code zero.');
assert.deepEqual(Object.keys(mappedProcessFixture.expectedEnrichedXml), ['Pressure1', 'HydroPressure', 'Temperature1', 'Temperature2', 'Temperature3', 'FluidDensity'], 'Regression fixture must assert all mapped process fields expected in enriched XML.');
assert.ok(base.includes('deriveRatingFromPipingClass') && base.includes('pc.includes(xcNorm(pattern))'), 'Regression context: base enrichment still has the broad rating derivation that preview/run parity overrides.');

console.log('XML->CII preview/run mapped process, HydroPressure, diagnostics, gasket-drop negative-chain, and DTXR_POS SIF=0 parity guard passed.', { fixture: mappedProcessFixture.branchName });
