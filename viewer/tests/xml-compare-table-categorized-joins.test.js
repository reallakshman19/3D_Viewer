import assert from 'node:assert/strict';

import { createJoinedRowContexts } from '../xml-compare/table-categorizer/table-categorized-xml-join-engine.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const s1=parseTableSource('PS NO\tDTXR\nPS-XYZ.1\tGUIDE\nPS-MISS.1\tREST',{sourceId:'S1',sourceName:'Model'});
const s2=parseTableSource('PS NO\tX\tY\tZ\nPS-XYZ.1\t1000\t2000\t3000\nPS-XYZ.1\t1001\t2000\t3000',{sourceId:'S2',sourceName:'Coordinates'});
const join={joinId:'join_table2_coordinates',leftSourceId:'S1',rightSourceId:'S2',joinType:'left',leftKeyResolver:{sourceId:'S1',column:'PS NO',pipeline:[{op:'trim'}]},rightKeyResolver:{sourceId:'S2',column:'PS NO',pipeline:[{op:'trim'}]},outputAlias:'coordinateLookup',duplicatePolicy:'diagnostic',missingPolicy:'warning'};
const result=createJoinedRowContexts([s1,s2],[join],{drivingSourceId:'S1'});
assert.ok(result.rows.find((row)=>row.sourceRows.S1?.rowId==='S1:1'&&row.sourceRows.S2?.rowId==='S2:1'));
assert.ok(result.rows.some((row)=>row.sourceRefs.includes('S1:1')&&row.sourceRefs.includes('S2:1')));
assert.ok(result.diagnostics.some((d)=>d.code==='join_duplicate_right_rows'));
assert.ok(result.diagnostics.some((d)=>d.code==='join_missing_right_row'));
assert.equal(result.rows.find((row)=>row.sourceRows.S1?.rowId==='S1:1').rawByHeader['S2.X'],'1000');
assert.equal(result.rows.find((row)=>row.sourceRows.S1?.rowId==='S1:1').rawByHeader['coordinateLookup.X'],'1000');

const inner=createJoinedRowContexts([s1,s2],[{...join,joinType:'inner',duplicatePolicy:'first'}],{drivingSourceId:'S1'});
assert.equal(inner.rows.length,1);
console.log('xml-compare-table-categorized-joins: all assertions passed');
