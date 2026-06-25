#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildXmlCiiCustomInputXml } from '../viewer/converters/xml-cii2019-core/custom-input-api.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const files=['viewer/converters/xml-cii2019-core/custom-input-table-parser.js','viewer/converters/xml-cii2019-core/custom-input-model.js','viewer/converters/xml-cii2019-core/custom-input-xml-builder.js','viewer/converters/xml-cii2019-core/custom-input-auto-bend.js','viewer/converters/xml-cii2019-core/custom-input-auto-tee.js','viewer/converters/xml-cii2019-core/custom-input-auto-reducer.js','viewer/converters/xml-cii2019-core/custom-input-api.js','viewer/tabs/model-converters/custom-input/custom-input-panel.js','viewer/tabs/model-converters/custom-input/xml-cii-custom-input-workflow-tab.js'];
for(const f of files){assert.ok(fs.existsSync(path.join(root,f)),`${f} must exist`); const lines=read(f).split(/\r?\n/).length; assert.ok(lines<200,`${f} must stay below 200 lines, got ${lines}`);}
const shell=read('viewer/tabs/model-converters/WorkflowShell.js');
const modelTab=read('viewer/tabs/model-converters/ModelConvertersTab.js');
assert.ok(shell.includes("id: 'custom-input'") && shell.indexOf("id: 'import-masters'") < shell.indexOf("id: 'custom-input'"), 'Custom Input phase must sit after Import Masters');
assert.ok(modelTab.includes('installXmlCiiCustomInputWorkflowTab'), 'ModelConvertersTab must install Custom Input workflow UI');
const tables={branchRows:'BranchName\tNodeNumber\tBoreMm\tWallThickness\tP1\tT1\tT2\tT3\tFluidDensity\n/CUSTOM/B1\t100\t100\t6.02\t4140\t260\t151\t5\t983\n/CUSTOM/B1\t110\t100\t6.02\t4140\t260\t151\t5\t983',coordinateRows:'BranchName\tNodeNumber\tX\tY\tZ\n/CUSTOM/B1\t100\t0\t0\t0\n/CUSTOM/B1\t110\t500\t0\t0',weightRows:'BranchName\tNodeNumber\tComponentType\tRigid\tEndpoint\tWeight\n/CUSTOM/B1\t100\tPIPE\t0\t1\t0\n/CUSTOM/B1\t110\tRIGID\t2\t2\t0',dtxrRows:'BranchName\tNodeNumber\tDTXR\n/CUSTOM/B1\t110\tGATE VALVE FLGD 300#'};
const {xmlText,summary}=buildXmlCiiCustomInputXml(tables,{dropShortElementLengthNodes:false});
assert.equal(summary.branches,1); assert.equal(summary.nodes,2); assert.ok(xmlText.includes('<Branchname>/CUSTOM/B1</Branchname>')); assert.ok(xmlText.includes('<NodeNumber>110</NodeNumber>')); assert.ok(xmlText.includes('<Position>500 0 0</Position>')); assert.ok(xmlText.includes('<DTXR_POS>GATE VALVE FLGD 300#</DTXR_POS>')); assert.ok(xmlText.includes('<ElementLengthMm>500.000</ElementLengthMm>'));
console.log('XML CII custom input source guard passed',{branches:summary.branches,nodes:summary.nodes});
