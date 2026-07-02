import assert from 'node:assert/strict';

import { createCanvasHandoffArtifact } from '../xml-compare/table-categorizer/table-categorized-xml-canvas-handoff.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});

const sourceArtifact=createCanvasHandoffArtifact({exportResult,graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,targetCanvas:'source'});
assert.equal(sourceArtifact.targetCanvas,'source');
assert.equal(sourceArtifact.origin,'table-to-categorized-xml');
assert.ok(sourceArtifact.xmlText.includes('<categorizedTableGraph'));
assert.ok(sourceArtifact.graphJson.nodes.length>0);
assert.equal(sourceArtifact.profileJson.profileId,'ps-mapping-table-2-shadow-profile');
assert.ok(Array.isArray(sourceArtifact.diagnostics));
assert.ok(sourceArtifact.sourceRefs.includes('S1:1'));

const targetArtifact=createCanvasHandoffArtifact({exportResult,graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,targetCanvas:'target'});
assert.equal(targetArtifact.targetCanvas,'target');
assert.equal(targetArtifact.artifactType,'categorizedXml');

const blockedExport={ok:false,xmlText:'',diagnostics:[{severity:'BLOCKER',code:'x',message:'blocked'}]};
assert.equal(createCanvasHandoffArtifact({exportResult:blockedExport,graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,targetCanvas:'source'}),null);

console.log('xml-compare-table-categorized-canvas-handoff: all assertions passed');
