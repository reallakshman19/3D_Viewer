#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildXmlCiiCustomInputXml, parseXmlCiiStagedJsonInputSource, stagedTraceToCsv } from '../viewer/converters/xml-cii2019-core/custom-input-api.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const files=['viewer/converters/xml-cii2019-core/custom-input-table-parser.js','viewer/converters/xml-cii2019-core/custom-input-model.js','viewer/converters/xml-cii2019-core/custom-input-xml-builder.js','viewer/converters/xml-cii2019-core/custom-input-auto-bend.js','viewer/converters/xml-cii2019-core/custom-input-auto-tee.js','viewer/converters/xml-cii2019-core/custom-input-auto-reducer.js','viewer/converters/xml-cii2019-core/custom-input-staged-json-source.js','viewer/converters/xml-cii2019-core/custom-input-api.js','viewer/tabs/model-converters/custom-input/custom-input-panel.js','viewer/tabs/model-converters/custom-input/xml-cii-custom-input-workflow-tab.js'];
for(const f of files){assert.ok(fs.existsSync(path.join(root,f)),`${f} must exist`); const lines=read(f).split(/\r?\n/).length; assert.ok(lines<200,`${f} must stay below 200 lines, got ${lines}`);}
const shell=read('viewer/tabs/model-converters/WorkflowShell.js');
const modelTab=read('viewer/tabs/model-converters/ModelConvertersTab.js');
const panel=read('viewer/tabs/model-converters/custom-input/custom-input-panel.js');
const api=read('viewer/converters/xml-cii2019-core/custom-input-api.js');
assert.ok(shell.includes("id: 'custom-input'") && shell.indexOf("id: 'import-masters'") < shell.indexOf("id: 'custom-input'"), 'Custom Input phase must sit after Import Masters');
assert.ok(modelTab.includes('installXmlCiiCustomInputWorkflowTab'), 'ModelConvertersTab must install Custom Input workflow UI');
assert.ok(panel.includes('Input Source') && panel.includes('Parse staged JSON') && panel.includes('Export trace CSV'), 'Custom Input UI must expose staged JSON parser and trace export');
assert.ok(api.includes('parseXmlCiiStagedJsonInputSource') && api.includes('stagedTraceToCsv'), 'API must expose staged input parser and trace exporter');
const tables={branchRows:'BranchName\tNodeNumber\tBoreMm\tWallThickness\tP1\tT1\tT2\tT3\tFluidDensity\n/CUSTOM/B1\t100\t100\t6.02\t4140\t260\t151\t5\t983\n/CUSTOM/B1\t110\t100\t6.02\t4140\t260\t151\t5\t983',coordinateRows:'BranchName\tNodeNumber\tX\tY\tZ\n/CUSTOM/B1\t100\t0\t0\t0\n/CUSTOM/B1\t110\t500\t0\t0',weightRows:'BranchName\tNodeNumber\tComponentType\tRigid\tEndpoint\tWeight\n/CUSTOM/B1\t100\tPIPE\t0\t1\t0\n/CUSTOM/B1\t110\tRIGID\t2\t2\t0',dtxrRows:'BranchName\tNodeNumber\tDTXR\n/CUSTOM/B1\t110\tGATE VALVE FLGD 300#'};
const {xmlText,summary}=buildXmlCiiCustomInputXml(tables,{dropShortElementLengthNodes:false});
assert.equal(summary.branches,1); assert.equal(summary.nodes,2); assert.ok(xmlText.includes('<Branchname>/CUSTOM/B1</Branchname>')); assert.ok(xmlText.includes('<NodeNumber>110</NodeNumber>')); assert.ok(xmlText.includes('<Position>500 0 0</Position>')); assert.ok(xmlText.includes('<DTXR_POS>GATE VALVE FLGD 300#</DTXR_POS>')); assert.ok(xmlText.includes('<ElementLengthMm>500.000</ElementLengthMm>'));
const staged={children:[{type:'BRANCH',name:'/STAGED/B1',children:[{type:'VALV',name:'1006649732/115524',attributes:{REF:'=1006649732/115524',DTXR:'GATE VALVE FLGD 300#',APOS:'E 10mm S 20mm U 30mm',ABORE:'100',WEIGHT:'99'}},{type:'SUPPORT',attributes:{NAME:'PS-1001',POS:'E 10mm S 20mm U 30mm',SUPPORT_KIND:'GUIDE',NODEGAP:'5'}}]}]};
const parsed=parseXmlCiiStagedJsonInputSource(JSON.stringify(staged));
assert.equal(parsed.summary.branches,1); assert.equal(parsed.summary.dtxr,1); assert.equal(parsed.summary.supports,1); assert.ok(parsed.tablesText.dtxrRows.includes('GATE VALVE FLGD 300#')); assert.ok(parsed.tablesText.restraintRows.includes('GUIDE')); assert.ok(parsed.trace.some(r=>r.field==='DTXR'&&r.sourcePath.includes('attributes.DTXR')&&r.matchMethod==='component-refno-exact')); assert.ok(parsed.trace.every(r=>r.sourcePath&&r.parserRuleId&&r.matchMethod&&r.status)); assert.ok(stagedTraceToCsv(parsed.trace).includes('sourcePath'));
console.log('XML CII custom input source guard passed',{branches:summary.branches,nodes:summary.nodes,stagedTrace:parsed.trace.length});
