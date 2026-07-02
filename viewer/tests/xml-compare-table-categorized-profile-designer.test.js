import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { addChildLevel, createBlankUniversalProfile, createPsMappingTable2TemplateProfile, serializeProfile, setChildrenNames, updateLevelAtPath, updateProfileHeader } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_SAMPLE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

let blank=createBlankUniversalProfile();
assert.equal(blank.schema,'UniversalCategorizerProfile.v1');
assert.equal(blank.levelDefinitions[0].documentRoot,true);
assert.equal(blank.levelDefinitions[0].children[0].levelId,'rootPartition');

const psTemplate=createPsMappingTable2TemplateProfile();
assert.equal(psTemplate.profileId,'ps-mapping-table-2-shadow-profile');
assert.equal(psTemplate.levelDefinitions[0].children[0].children[0].levelId,'supportFamily');

const templateAfterPlaceholderApply=setChildrenNames(psTemplate,[0,0],['Parent (x)','Parent (y)','Parent (z)'],{keyColumn:'PS NO'});
assert.equal(templateAfterPlaceholderApply.levelDefinitions[0].children[0].children[0].levelId,'supportFamily','placeholder apply preserves existing PS template child');
assert.equal(templateAfterPlaceholderApply.levelDefinitions[0].children[0].children[0].children[0].levelId,'supportOccurrence','placeholder apply preserves existing subtree');

const templateAfterRename=setChildrenNames(psTemplate,[0,0],['Model Support Family'],{keyColumn:'PS NO'});
assert.equal(templateAfterRename.levelDefinitions[0].children[0].children[0].levelId,'supportFamily','renaming preserves existing level id');
assert.equal(templateAfterRename.levelDefinitions[0].children[0].children[0].displayName,'Model Support Family');
assert.equal(templateAfterRename.levelDefinitions[0].children[0].children[0].children[0].levelId,'supportOccurrence','renaming preserves existing subtree');

blank=updateProfileHeader(blank,{profileId:'edited-profile',displayName:'Edited Profile'});
blank=updateLevelAtPath(blank,[0],{displayName:'EditedRoot',key:'EDITED_ROOT'});
blank=updateLevelAtPath(blank,[0,0],{displayName:'EditedPartition',key:'MODEL_SIDE'});
assert.equal(blank.levelDefinitions[0].displayName,'EditedRoot');
assert.equal(blank.levelDefinitions[0].children[0].displayName,'EditedPartition');

blank=setChildrenNames(blank,[0,0],['Parent X','Parent Y','Parent Z'],{keyColumn:'PS NO'});
assert.deepEqual(blank.levelDefinitions[0].children[0].children.map((l)=>l.displayName),['Parent X','Parent Y','Parent Z']);
blank=setChildrenNames(blank,[0,0,0],['Child A','Child B','Child C'],{keyColumn:'PS NO'});
assert.equal(blank.levelDefinitions[0].children[0].children[0].children.length,3);
blank=setChildrenNames(blank,[0,0,0,0],['GrandChild A','GrandChild B','GrandChild C'],{keyColumn:'PS NO'});
assert.equal(blank.levelDefinitions[0].children[0].children[0].children[0].children.length,3);
blank=addChildLevel(blank,[0,0,0,0,0],{levelId:'nextLevelA',displayName:'Next Level A',levelType:'attribute',creationMode:'one-per-row',keyResolver:{op:'trim',column:'PS NO'}});
assert.equal(blank.levelDefinitions[0].children[0].children[0].children[0].children[0].children[0].levelId,'nextLevelA');

const text=serializeProfile(blank);
const parsed=JSON.parse(text);
assert.ok(Array.isArray(parsed.levelDefinitions));
assert.equal('parentTabs' in parsed,false);
assert.equal('childTabs' in parsed,false);
assert.equal('grandChildTabs' in parsed,false);
assert.ok(text.includes('GrandChild A'));

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1'});
const graph=buildCategorizedGraph(psTemplate,[source]);
const family=graph.nodes.find((node)=>node.key==='PS-XYZ__C001');
const childKeys=new Set(graph.edges.filter((edge)=>edge.fromNodeId===family.id).map((edge)=>graph.nodes.find((node)=>node.id===edge.toNodeId).key));
assert.ok(childKeys.has('PS-XYZ.1'));
assert.ok(childKeys.has('PS-XYZ.10'));
assert.ok(graph.nodes.find((node)=>node.key==='PS-XYZ__C002'));
assert.ok(graph.nodes.find((node)=>node.key==='PS-ABC__C001'));

const editedForBuild=setChildrenNames(createBlankUniversalProfile(),[0,0],['Custom Parent'],{keyColumn:'PS NO'});
const editedGraph=buildCategorizedGraph(updateProfileHeader(editedForBuild,{profileId:'edited-build-profile'}),[source]);
assert.ok(editedGraph.nodes.some((node)=>node.levelId==='customParent'),'graph build uses edited profile levels');
const validation=runCategorizerValidation({profile:updateProfileHeader(editedForBuild,{profileId:'edited-build-profile'}),sources:[source],graph:editedGraph});
const exported=exportCategorizedGraphArtifacts({graph:editedGraph,profile:updateProfileHeader(editedForBuild,{profileId:'edited-build-profile'}),validationResults:validation,sources:[source]});
assert.ok(exported.profileJson.includes('edited-build-profile'));
assert.ok(exported.xmlText.includes('profileId="edited-build-profile"'));

console.log('xml-compare-table-categorized-profile-designer: all assertions passed');
