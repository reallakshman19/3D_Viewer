import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { hasBlockingValidation, runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

function gate(results,name){return results.find((item)=>item.gate===name);}

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const valid=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
assert.equal(gate(valid,'graph_has_single_document_root').status,'PASS');
assert.equal(hasBlockingValidation(valid),false);

const noPs=parseTableSource('Bore\tpipe\tDTXR\tSupport Gap\tMandatory\nDN80\tLINE-A\tGUIDE\t10\tYES');
const noPsResult=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[noPs],graph:null});
assert.equal(gate(noPsResult,'required_columns_present').severity,'BLOCKER');
assert.ok(gate(noPsResult,'required_columns_present').message.includes('PS NO'));

const noDtxr=parseTableSource('PS NO\tBore\tpipe\tSupport Gap\tMandatory\nPS-1\tDN80\tLINE-A\t10\tYES');
const noDtxrResult=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[noDtxr],graph:null});
assert.equal(gate(noDtxrResult,'required_columns_present').severity,'BLOCKER');
assert.ok(gate(noDtxrResult,'required_columns_present').message.includes('DTXR'));

const noCoord=parseTableSource('PS NO\tBore\tpipe\tDTXR\tSupport Gap\tMandatory\nPS-1\tDN80\tLINE-A\tGUIDE\t10\tYES');
const noCoordGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[noCoord]);
const noCoordResult=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[noCoord],graph:noCoordGraph});
assert.equal(gate(noCoordResult,'resolver_outputs_non_empty').severity,'WARNING');
assert.equal(hasBlockingValidation(noCoordResult),false);

const duplicateGraph={...graph,nodes:[...graph.nodes,{...graph.nodes.find((node)=>node.key==='PS-XYZ.1'),id:'node_dup'}]};
const dupResult=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph:duplicateGraph});
assert.equal(gate(dupResult,'key_uniqueness_per_parent').status,'FAIL');

const twoRootGraph={...graph,documentRootNodeIds:['node_001','node_999']};
const twoRootResult=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph:twoRootGraph});
assert.equal(gate(twoRootResult,'graph_has_single_document_root').status,'FAIL');

console.log('xml-compare-table-categorized-validation: all assertions passed');
