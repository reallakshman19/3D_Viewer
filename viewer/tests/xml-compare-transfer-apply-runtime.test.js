import assert from 'node:assert/strict';

import { applyTransferPreviewToTarget, _test } from '../tabs/xml-compare-transfer-apply-runtime.js';

const source=`<CategorizedInputXML schema="categorized-inputxml/v2"><Line id="SRC"><LineBlocks><ProcessBlock scope="line"><PRESSURE1>700</PRESSURE1></ProcessBlock></LineBlocks><Element fromNode="10" toNode="20" elementKey="10->20"><RouteGeometryBlock><DELTA_X>10</DELTA_X></RouteGeometryBlock></Element></Line></CategorizedInputXML>`;
const target=`<CategorizedInputXML schema="categorized-inputxml/v2"><Line id="TGT"><LineBlocks><ProcessBlock scope="line"><PRESSURE1>100</PRESSURE1></ProcessBlock></LineBlocks><Element fromNode="1000" toNode="1010" elementKey="1000->1010"><RouteGeometryBlock><DELTA_X>1</DELTA_X></RouteGeometryBlock></Element></Line></CategorizedInputXML>`;

assert.equal(_test.isCategorized(source),true);
assert.equal(_test.isCategorized('<xml/>'),false);
assert.equal(_test.transferredFileName('target.xml'),'target_transferred_categorized.xml');
assert.equal(_test.transferredFileName('target_categorized_enriched.xml'),'target_categorized_enriched_transferred_categorized.xml');

const result=applyTransferPreviewToTarget({
  sourceText:source,
  targetText:target,
  previewPlan:{
    transferScope:'line',
    selectedBlocks:['ProcessBlock'],
    pairs:[{sourceLine:'SRC',targetLine:'TGT'}]
  }
});

assert.equal(result.audit[0].status,'updated');
assert.match(result.xml,/<PRESSURE1>700<\/PRESSURE1>/);
assert.doesNotMatch(result.xml,/<PRESSURE1>100<\/PRESSURE1>/);
assert.throws(()=>applyTransferPreviewToTarget({sourceText:'<xml/>',targetText:target,previewPlan:{}}),/Source A must be CategorizedInputXML/);
assert.throws(()=>applyTransferPreviewToTarget({sourceText:source,targetText:'<xml/>',previewPlan:{}}),/Target B must be CategorizedInputXML/);

console.log('xml-compare-transfer-apply-runtime: all assertions passed');
