import assert from 'node:assert/strict';

import { createBlankUniversalProfile, coordinateClusterResolver, setChildrenNames, updateLevelAtPath, updateProfileHeader } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { validateEditableProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-validation.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

function codes(items){return new Set(items.map((item)=>item.gate));}

const valid=createBlankUniversalProfile();
assert.equal(validateEditableProfile(valid).some((d)=>d.severity==='BLOCKER'),false);

const duplicate={...valid,levelDefinitions:[{...valid.levelDefinitions[0],children:[valid.levelDefinitions[0].children[0],{...valid.levelDefinitions[0].children[0]}]}]};
assert.ok(codes(validateEditableProfile(duplicate)).has('duplicate_level_id'));

const noRoot=updateLevelAtPath(valid,[0],{documentRoot:false});
assert.ok(codes(validateEditableProfile(noRoot)).has('document_root_missing'));

const multiRoot=updateLevelAtPath(valid,[0,0],{documentRoot:true});
assert.ok(codes(validateEditableProfile(multiRoot)).has('document_root_multiple'));

let badCluster=setChildrenNames(createBlankUniversalProfile(),[0,0],['Coord Parent'],{keyColumn:'PS NO'});
badCluster=updateLevelAtPath(badCluster,[0,0,0],{keyResolver:coordinateClusterResolver({x:'X',y:'Y',z:'Z',unit:'mm',tolerance:2})});
const broken=JSON.parse(JSON.stringify(badCluster));
delete broken.levelDefinitions[0].children[0].children[0].keyResolver.contract.tolerance;
assert.ok(codes(validateEditableProfile(broken)).has('coordinate_tolerance_missing'));

const source=parseTableSource('PS NO\tX\tY\tZ\nPS-01\t1\t2\t3');
let missingColumn=setChildrenNames(updateProfileHeader(createBlankUniversalProfile(),{profileId:'x'}),[0,0],['Bad Parent'],{keyColumn:'Missing Column'});
assert.ok(codes(validateEditableProfile(missingColumn,{source})).has('resolver_source_column_missing'));

console.log('xml-compare-table-categorized-profile-validation: all assertions passed');
