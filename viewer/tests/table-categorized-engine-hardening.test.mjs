import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { validateEditableProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-validation.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const profile=(mode='one-per-row')=>({
  profileId:'engine-hardening-test',
  duplicateKeyPolicy:'warn',
  multiValuePolicy:'first',
  rootPartitionMode:'static',
  rootPartitions:[{key:'MODEL_SIDE',displayName:'Model Side',sourceScope:['S1']}],
  levelDefinitions:[{levelId:'documentRoot',xmlTag:'PlantXml',levelType:'container',creationMode:'static',key:'ROOT',documentRoot:true,children:[{levelId:'rootPartition',xmlTag:'ModelSection',levelType:'partition',creationMode:'static',key:'MODEL_SIDE',children:[{levelId:'supportOccurrence',xmlTag:'Support',levelType:'occurrence',creationMode:mode}]}]}]
});
const source=parseTableSource('A|B\n1|x\n2|y',{sourceId:'S1',sourceName:'T',delimiterMode:'pipe'});

const graph=buildCategorizedGraph(profile(),[source]);
const supportNodes=graph.nodes.filter((node)=>node.levelId==='supportOccurrence');
assert.equal(supportNodes.length,2);
assert.deepEqual(new Set(supportNodes.map((node)=>node.key)).size,2,'one-per-row fallback produces unique row keys');
assert.ok(supportNodes.some((node)=>node.key==='S1:1'));
assert.ok(supportNodes.some((node)=>node.key==='S1:2'));

const exportResult=exportCategorizedGraphArtifacts({graph,profile:profile(),validationResults:[],sources:[source]});
assert.equal(exportResult.ok,true);
assert.ok(exportResult.xmlText.startsWith('<PlantXml '));
assert.ok(exportResult.xmlText.includes('<ModelSection '));
assert.ok(exportResult.xmlText.includes('<Support '));
assert.ok(!exportResult.xmlText.includes('<supportOccurrence'));
assert.equal((exportResult.xmlText.match(/<PlantXml /g)||[]).length,1);
assert.equal((exportResult.xmlText.match(/<\/PlantXml>/g)||[]).length,1);

for(const mode of ['many-per-row','conditional','lookup-joined','coordinate-clustered']){
  const diagnostics=validateEditableProfile(profile(mode),{sources:[source]});
  const blocker=diagnostics.find((item)=>item.severity==='BLOCKER'&&item.message.includes(mode));
  assert.ok(blocker,`missing unsupported creation-mode blocker for ${mode}`);
}

const dup=parseTableSource('A|A|B\n1|2|3',{sourceId:'S1',delimiterMode:'pipe'});
assert.ok(dup.diagnostics.some((item)=>item.code==='duplicate_header_preserved'));
assert.deepEqual(dup.headers,['A','A','B']);
assert.deepEqual(new Set(dup.columnIds).size,3);
assert.equal(dup.rows[0].rawCells[0],'1');
assert.equal(dup.rows[0].rawCells[1],'2');
assert.equal(dup.rows[0].rawByColumnId[dup.columnIds[0]],'1');
assert.equal(dup.rows[0].rawByColumnId[dup.columnIds[1]],'2');

assert.equal(parseTableSource('A,B\n1,2',{delimiterMode:'comma'}).delimiter,'comma');
assert.equal(parseTableSource('A|B\n1|2',{delimiterMode:'pipe'}).delimiter,'pipe');
assert.equal(parseTableSource('A\tB\n1\t2',{delimiterMode:'tab'}).delimiter,'tab');
assert.equal(parseTableSource('A;B\n1;2',{delimiterMode:'semicolon'}).delimiter,'semicolon');
assert.equal(parseTableSource('A|B\n1|2',{delimiterMode:'auto'}).delimiter,'pipe');
assert.ok(parseTableSource('A|B\n1|2',{delimiterMode:'bad'}).diagnostics.some((item)=>item.code==='delimiter_override_invalid'));

console.log('table-categorized-engine-hardening: all assertions passed');
