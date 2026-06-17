import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseInputXmlBasic } from '../converters/inputxml-basic-glb/InputXmlBasicParser.js';
import { run } from '../converters/inputxml-basic-glb/inputxml-basic-glb-runner.js';

const xml = `<CAESARII VERSION="11.00" XML_TYPE="Input"><PIPINGMODEL JOBNAME="BASIC">
<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" DELTA_X="1000" DELTA_Y="0" DELTA_Z="0" DIAMETER="100" />
<PIPINGELEMENT FROM_NODE="20" TO_NODE="30" DELTA_X="0" DELTA_Y="500" DELTA_Z="0" DIAMETER="100"><VALVE /><RESTRAINT NODE="20" TYPE="17" XCOSINE="0" YCOSINE="0" ZCOSINE="1" /></PIPINGELEMENT>
<PIPINGELEMENT FROM_NODE="30" TO_NODE="40" DELTA_X="0" DELTA_Y="0" DELTA_Z="350" DIAMETER="100"><BEND RADIUS="150" ANGLE="90" /><HANGER NODE="40" /></PIPINGELEMENT>
</PIPINGMODEL></CAESARII>`;

// ---------------------------------------------------------------------------
// 1. Parser: pure JS, works in Node without three.js
// ---------------------------------------------------------------------------
const parsed = parseInputXmlBasic(xml, { sourceName: 'basic.xml' });
assert.equal(parsed.schema, 'inputxml-basic-glb-model/v1');
assert.equal(parsed.stats.elementCount, 3);
assert.equal(parsed.stats.nodeCount, 4);
assert.equal(parsed.stats.supportCount, 2);
assert.equal(parsed.stats.typeCounts.PIPE, 1);
assert.equal(parsed.stats.typeCounts.VALVE, 1);
assert.equal(parsed.stats.typeCounts.BEND, 1);
assert.equal(parsed.stats.supportKindCounts.REST, 1);
assert.equal(parsed.stats.supportKindCounts.HANGER, 1);
assert.deepEqual(parsed.nodes['40'], { x: 1000, y: 500, z: 350 });

// ---------------------------------------------------------------------------
// 2. Runner: three.js may not be available in Node; degrade gracefully
// ---------------------------------------------------------------------------
const response = await run({ inputFiles: [{ role: 'primary', name: 'basic.xml', text: xml }], options: { includeSidecarJson: true } });
assert.equal(response.ok, true, `run must succeed; stderr: ${JSON.stringify(response?.logs?.stderr)}`);

// Sidecar JSON is always output (no three.js needed)
const sidecar_output = response.outputs.find((o) => o.name.endsWith('-basic-glb-sidecar.json'));
assert.ok(sidecar_output, 'must emit a sidecar JSON output');
const sidecar = JSON.parse(sidecar_output.text);
assert.equal(sidecar.schema, 'inputxml-basic-glb-sidecar/v1');
assert.equal(sidecar.independentPath, true);
assert.equal(sidecar.stats.supportCount, 2);

// GLB is emitted in browser (three.js available); in Node.js it is skipped
const glb_output = response.outputs.find((o) => o.name.endsWith('-basic.glb'));
if (glb_output) {
  assert.equal(glb_output.mime, 'model/gltf-binary');
  assert.ok(glb_output.base64.length > 0, 'GLB must be non-empty');
} else {
  const skipped = response.logs.stdout.some((line) => /Basic GLB skipped/.test(line));
  assert.ok(skipped, 'GLB skipped log must be present when three.js is unavailable');
}

// ---------------------------------------------------------------------------
// 3. Source integrity checks
// ---------------------------------------------------------------------------
const runnerSource = fs.readFileSync(new URL('../converters/inputxml-basic-glb/inputxml-basic-glb-runner.js', import.meta.url), 'utf8');
assert.equal(/inputxml-dxf|pcf2glb\/glb\/buildExportScene|inputxml-glb\/inputxml-to-glb-runner/.test(runnerSource), false, 'runner must not import shared converter modules');

const bridgeSource = fs.readFileSync(new URL('../tabs/model-converters/inputxml-basic-glb-bridge.js', import.meta.url), 'utf8');
assert.match(bridgeSource, /inputxml_to_basic_glb/);
assert.match(bridgeSource, /InputXML→Basic GLB/);

const tabSource = fs.readFileSync(new URL('../tabs/model-converters-tab.js', import.meta.url), 'utf8');
assert.match(tabSource, /installInputXmlBasicGlbBridge/);
assert.match(tabSource, /inputxml-basic-glb-bridge/);

console.log('inputxml-basic-glb-independent: all assertions passed');
