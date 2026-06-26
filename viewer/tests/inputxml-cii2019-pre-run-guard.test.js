import assert from 'node:assert/strict';

import {
  detectInputxml2019SourceKind,
  inputxml2019PopupHeaderFields,
  openInputxml2019PreRunPopup,
  prepareInputxml2019ConfigForRequirements,
  run,
} from '../tabs/model-converters/converters/inputxml-to-cii2019.js';

const encoder = new TextEncoder();

const caesarInputXml = `<CAESARII VERSION="11.00" XML_TYPE="Input"><PIPINGMODEL JOBNAME="BM">
<PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DELTA_X="100.000000" DELTA_Y="0.000000" DELTA_Z="0.000000"><BEND RADIUS="152.4" ANGLE1="90" /></PIPINGELEMENT>
</PIPINGMODEL></CAESARII>`;
const branchNodeXml = `<Root><Branch><Branchname>/ASIM-TEST/B1</Branchname><Node><NodeNumber>10</NodeNumber></Node></Branch></Root>`;

assert.equal(detectInputxml2019SourceKind(caesarInputXml), 'CAESARII_INPUTXML');
assert.equal(detectInputxml2019SourceKind(branchNodeXml), 'XML_CII_BRANCH_NODE');
assert.equal(detectInputxml2019SourceKind('<EnrichedInputXml/>'), 'UXML_OR_ENRICHED_INPUTXML');

const fieldsFromUndefined = inputxml2019PopupHeaderFields(undefined, { headerSource: 'SRC' });
assert.ok(fieldsFromUndefined.length >= 7, 'undefined converter definition must still yield safe default header fields');
assert.equal(fieldsFromUndefined.find((entry) => entry.key === 'headerSource').value, 'SRC');

const fieldsFromRuntimeOptionsObject = inputxml2019PopupHeaderFields({ options: { layoutConfigJson: '{}' } }, { headerProjectName: 'ZAU' });
assert.ok(fieldsFromRuntimeOptionsObject.length >= 7, 'runtime options object must not be treated as field array');
assert.equal(fieldsFromRuntimeOptionsObject.find((entry) => entry.key === 'headerProjectName').value, 'ZAU');

const prepared = prepareInputxml2019ConfigForRequirements('', {
  elementCount: 1,
  bendCount: 1,
  rigidCount: 0,
  restraintCount: 0,
  sifCount: 0,
  nodeCount: 2,
});
assert.match(prepared.jsonText, /schema_validated/);
assert.ok(prepared.requirementLines.some((line) => /Detected from selected XML: 1 elements/.test(line)));

let popupArgs = null;
const values = { headerSource: 'AVEVA PSI' };
const popupResult = await openInputxml2019PreRunPopup(
  { id: 'inputxml_to_cii2019', label: 'InputXML->CII(2019)', options: { notArray: true } },
  values,
  'demo.xml',
  encoder.encode(caesarInputXml).buffer,
  async (args) => {
    popupArgs = args;
    return { saved: true, payload: { jsonText: args.value, headerValues: { headerSource: 'TEST' } } };
  },
);
assert.equal(popupResult, true);
assert.equal(values.headerSource, 'TEST');
assert.ok(Array.isArray(popupArgs.headerFields), 'header fields must be array even when def.options is a runtime object');

await assert.rejects(
  () => openInputxml2019PreRunPopup(
    { id: 'inputxml_to_cii2019', label: 'InputXML->CII(2019)' },
    {},
    'branch-node.xml',
    encoder.encode(branchNodeXml).buffer,
    async () => ({ saved: true, payload: { jsonText: '{}' } }),
  ),
  /Use converter "XML->CII\(2019\)"/,
);

let workerRequest = null;
const runResponse = await run({
  converterId: 'inputxml_to_cii2019',
  inputFiles: [{ role: 'primary', name: 'demo.xml', bytes: encoder.encode(caesarInputXml).buffer }],
  options: {},
  workerRunner: {
    async runJob(request) {
      workerRequest = request;
      return { outputs: [{ name: 'demo.cii', text: 'cii', mime: 'text/plain' }], logs: { stdout: [], stderr: [] } };
    },
  },
});
assert.equal(runResponse.outputs[0].name, 'demo.cii');
assert.equal(workerRequest.inputFiles.length, 1);

console.log('inputxml-cii2019-pre-run-guard: all assertions passed');
