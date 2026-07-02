import assert from 'node:assert/strict';

import { applyTransferPreviewToTarget, _test } from '../tabs/xml-compare-transfer-apply-runtime.js';

const source=`<CategorizedInputXML schema="categorized-inputxml/v2"><Line id="SRC"><LineBlocks><ProcessBlock scope="line"><PRESSURE1>700</PRESSURE1></ProcessBlock><MaterialBlock scope="line"><MATERIAL_NAME>A106 B</MATERIAL_NAME></MaterialBlock></LineBlocks><Element fromNode="10" toNode="20" elementKey="10->20"><RouteGeometryBlock><DELTA_X>10</DELTA_X></RouteGeometryBlock><NodesBlock><Node nodeNumber="10" role="FROM"><RestraintsBlock><RESTRAINT NODE="10" TYPE="7"/></RestraintsBlock></Node></NodesBlock></Element></Line></CategorizedInputXML>`;
const target=`<CategorizedInputXML schema="categorized-inputxml/v2"><Line id="TGT"><LineBlocks><ProcessBlock scope="line"><PRESSURE1>100</PRESSURE1></ProcessBlock><MaterialBlock scope="line"><MATERIAL_NAME>OLD</MATERIAL_NAME></MaterialBlock></LineBlocks><Element fromNode="1000" toNode="1010" elementKey="1000->1010"><RouteGeometryBlock><DELTA_X>1</DELTA_X></RouteGeometryBlock><NodesBlock><Node nodeNumber="1000" role="FROM"><RestraintsBlock/></Node></NodesBlock></Element></Line></CategorizedInputXML>`;

assert.equal(_test.isCategorized(source),true);
assert.equal(_test.isCategorized('<xml/>'),false);
assert.equal(_test.transferredFileName('target.xml'),'target_transferred_categorized.xml');
assert.equal(_test.transferredFileName('target_categorized_enriched.xml'),'target_categorized_enriched_transferred_categorized.xml');

const fakePane={querySelector(selector){if(selector==='[data-xml-compare-selected-transfer-blocks]')return {options:[{value:'ProcessBlock'},{value:'MaterialBlock'}]};if(selector==='select[multiple]')return null;return null;},querySelectorAll(selector){if(selector==='[data-xml-compare-transfer-pair]')return [{checked:true,dataset:{xmlCompareTransferPair:'case-1'}},{checked:false,dataset:{xmlCompareTransferPair:'case-2'}}];return [];}};
const normalized=_test.normalizePlanForSelection({transferScope:'line',selectedBlocks:['ProcessBlock','MaterialBlock','AllowableStressBlock'],pairs:[{sourceLine:'SRC',targetLine:'TGT'}]},fakePane);
assert.deepEqual(normalized.selectedBlocks,['ProcessBlock','MaterialBlock']);
assert.deepEqual(normalized.approvedPairIds,['case-1']);

const processOnlyPane={querySelector(selector){if(selector==='select[multiple]')return {options:[{selected:true,value:'ProcessBlock'}]};return null;},querySelectorAll(){return [];}};
const processOnlyPlan=_test.normalizePlanForSelection({transferScope:'line',selectedBlocks:['ProcessBlock','MaterialBlock'],pairs:[{sourceLine:'SRC',targetLine:'TGT'}]},processOnlyPane);
assert.deepEqual(processOnlyPlan.selectedBlocks,['ProcessBlock']);

const lineResult=applyTransferPreviewToTarget({sourceText:source,targetText:target,previewPlan:processOnlyPlan});
assert.equal(lineResult.audit[0].status,'updated');
assert.match(lineResult.xml,/<PRESSURE1>700<\/PRESSURE1>/);
assert.doesNotMatch(lineResult.xml,/<PRESSURE1>100<\/PRESSURE1>/);
assert.match(lineResult.xml,/<MATERIAL_NAME>OLD<\/MATERIAL_NAME>/,'unselected MaterialBlock must remain unchanged');
assert.doesNotMatch(lineResult.xml,/<MATERIAL_NAME>A106 B<\/MATERIAL_NAME>/);

const nodePlan={transferScope:'node',selectedBlocks:['RestraintsBlock'],approvedPairIds:['node-case-1'],pairs:[{id:'node-case-1',sourceNode:'10',targetNode:'1000',sourceElement:'10->20',targetElement:'1000->1010'}]};
const nodeResult=applyTransferPreviewToTarget({sourceText:source,targetText:target,previewPlan:nodePlan});
assert.equal(nodeResult.audit[0].status,'updated');
assert.match(nodeResult.xml,/<RestraintsBlock>\s*<RESTRAINT NODE="1000" TYPE="7"\/>\s*<\/RestraintsBlock>/);
assert.doesNotMatch(nodeResult.xml,/NODE="10" TYPE="7"/);
assert.ok(_test.resultHtml('Prepared',nodeResult,'target_transferred.xml').includes('Changed blocks'));

assert.throws(()=>applyTransferPreviewToTarget({sourceText:source,targetText:target,previewPlan:{transferScope:'line',selectedBlocks:[],pairs:[{sourceLine:'SRC',targetLine:'TGT'}]}}),/Select at least one transfer block/);
assert.throws(()=>applyTransferPreviewToTarget({sourceText:'<xml/>',targetText:target,previewPlan:{}}),/Source A must be CategorizedInputXML/);
assert.throws(()=>applyTransferPreviewToTarget({sourceText:source,targetText:'<xml/>',previewPlan:{}}),/Target B must be CategorizedInputXML/);
console.log('xml-compare-transfer-apply-runtime: all assertions passed');
