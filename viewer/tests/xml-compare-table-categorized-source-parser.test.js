import assert from 'node:assert/strict';

import { buildSourceSummary, detectTableDelimiter, parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

function codes(source){return source.diagnostics.map((item)=>item.code);}

const tab=parseTableSource('PS NO\tBore\tGap\nPS-01\t4\t5\nPS-02\t6\t10',{sourceId:'S1'});
assert.equal(tab.delimiter,'tab');
assert.deepEqual(tab.headers,['PS NO','Bore','Gap']);
assert.equal(tab.rows.length,2);
assert.equal(tab.rows[0].rowId,'S1:1');
assert.equal(tab.rows[1].rowId,'S1:2');
assert.equal(tab.rows[0].rawByHeader['PS NO'],'PS-01');
assert.equal(tab.rows[0].rawCells[2],'5');

const comma=parseTableSource('Name,Bore,Remark\n"PS, 01",4,"kept, raw"');
assert.equal(comma.delimiter,'comma');
assert.deepEqual(comma.headers,['Name','Bore','Remark']);
assert.equal(comma.rows[0].rawCells[0],'PS, 01');
assert.equal(comma.rows[0].rawCells[2],'kept, raw');

const pipe=parseTableSource('PS NO|Bore|Gap\nPS-01|4|5');
assert.equal(pipe.delimiter,'pipe');
assert.deepEqual(pipe.headers,['PS NO','Bore','Gap']);

const whitespace=parseTableSource('PS_NO  Bore  Gap\nPS-01  4  5');
assert.equal(whitespace.delimiter,'whitespace');
assert.deepEqual(whitespace.headers,['PS_NO','Bore','Gap']);

const raw=parseTableSource('  Header A\tHeader B  \n  raw value\t  raw cell  ');
assert.deepEqual(raw.headers,['  Header A','Header B  ']);
assert.equal(raw.rows[0].rawCells[0],'  raw value');
assert.equal(raw.rows[0].rawByHeader['Header B  '],'  raw cell  ');

const mismatch=parseTableSource('A\tB\n1\t2\t3\n4\t5');
assert.ok(codes(mismatch).includes('row_1_column_count_mismatch'));
assert.equal(buildSourceSummary(mismatch).status,'Parsed with warnings');

const duplicate=parseTableSource('A|A|B\n1|2|3',{sourceId:'S1',delimiterMode:'pipe'});
assert.ok(codes(duplicate).includes('duplicate_header_preserved'));
assert.deepEqual(duplicate.headers,['A','A','B']);
assert.equal(new Set(duplicate.columnIds).size,3);
assert.equal(duplicate.rows[0].rawCells[0],'1');
assert.equal(duplicate.rows[0].rawCells[1],'2');
assert.equal(duplicate.rows[0].rawByColumnId[duplicate.columnIds[0]],'1');
assert.equal(duplicate.rows[0].rawByColumnId[duplicate.columnIds[1]],'2');

assert.equal(parseTableSource('A,B\n1,2',{delimiterMode:'comma'}).delimiter,'comma');
assert.equal(parseTableSource('A|B\n1|2',{delimiterMode:'pipe'}).delimiter,'pipe');
assert.equal(parseTableSource('A\tB\n1\t2',{delimiterMode:'tab'}).delimiter,'tab');
assert.equal(parseTableSource('A;B\n1;2',{delimiterMode:'semicolon'}).delimiter,'semicolon');
assert.equal(parseTableSource('A|B\n1|2',{delimiterMode:'auto'}).delimiter,'pipe');
assert.ok(codes(parseTableSource('A|B\n1|2',{delimiterMode:'bad'})).includes('delimiter_override_invalid'));

const empty=parseTableSource('  \n\n');
assert.equal(empty.rows.length,0);
assert.equal(empty.headers.length,0);
assert.ok(codes(empty).includes('empty_input'));

assert.equal(detectTableDelimiter(['A|B|C','1|2|3']).id,'pipe');
console.log('xml-compare-table-categorized-source-parser: all assertions passed');
