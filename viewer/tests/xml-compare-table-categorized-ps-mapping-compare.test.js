import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { comparePsMappingCategorizedGraphs, indexPsMappingGraph } from '../xml-compare/table-categorizer/table-categorized-xml-ps-mapping-compare.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const targetText=`PS NO\tBore\tpipe\tDTXR\tSupport Gap\tMandatory\tX\tY\tZ
PS-XYZ.1\tDN80\tLINE-A\tGUIDE\t25\tYES\t1000\t2000\t3000
PS-XYZ.2\tDN80\tLINE-A\tLINE STOP\t0\tYES\t1001\t2000\t3000
PS-XYZ.10\tDN80\tLINE-A\tGUIDE\t10\tYES\t1000.2\t2000\t3000
PS-XYZ.3\tDN80\tLINE-A\tGUIDE\t10\tYES\t1500\t2000\t3000
PS-ABC.1\tDN80\tLINE-A\tGUIDE\t10\tNO\t1000\t2000\t3000
PS-NEW.1\tDN80\tLINE-A\tGUIDE\t10\tYES\t3000\t2000\t3000`;

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Model Table 2'});
const target=parseTableSource(targetText,{sourceId:'S1',sourceName:'Reference Table 2'});
const sourceGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const targetGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[target]);

const index=indexPsMappingGraph(sourceGraph);
assert.ok(index.families.has('PS-XYZ__C001'));
assert.ok(index.families.get('PS-XYZ__C001').occurrences.has('PS-XYZ.1'));
assert.ok(index.families.get('PS-XYZ__C001').occurrences.get('PS-XYZ.1').features.has('GUIDE'));

const compare=comparePsMappingCategorizedGraphs({sourceGraph,targetGraph,sourceName:'Model graph',targetName:'Reference graph'});
assert.equal(compare.mode,'shadow');
assert.ok(compare.summary.mapped>0);
assert.ok(compare.missing.some((item)=>item.level==='SupportOccurrence'&&item.path.includes('PS-XYZ.7')));
assert.ok(compare.extra.some((item)=>item.level==='SupportFamily'&&item.path.includes('PS-NEW')));
assert.ok(compare.mismatches.some((item)=>item.field==='Gap'&&item.path.includes('PS-XYZ.1')));
assert.ok(compare.mismatches.some((item)=>item.field==='Mandatory'&&item.path.includes('PS-ABC.1')));
assert.ok(compare.diagnostics.some((item)=>item.code==='graph_compare_missing'));
assert.ok(compare.diagnostics.some((item)=>item.code==='graph_compare_extra'));
assert.ok(compare.diagnostics.some((item)=>item.code==='graph_compare_mismatch'));
assert.ok(compare.findings.some((text)=>text.startsWith('MISSING SupportOccurrence')));
assert.ok(compare.findings.some((text)=>text.startsWith('MISMATCH Gap')));

const clean=comparePsMappingCategorizedGraphs({sourceGraph,targetGraph:sourceGraph});
assert.equal(clean.summary.missing,0);
assert.equal(clean.summary.extra,0);
assert.equal(clean.summary.mismatch,0);
assert.ok(clean.summary.mapped>0);

console.log('xml-compare-table-categorized-ps-mapping-compare: all assertions passed');
