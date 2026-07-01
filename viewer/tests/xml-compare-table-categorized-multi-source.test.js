import assert from 'node:assert/strict';

import { createMultiSourceState, addSource, parseSourceDraft, updateSourceDraft, setActiveSource, activeSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-manager.js';
import { runResolver } from '../xml-compare/table-categorizer/table-categorized-xml-resolver-engine.js';

let state=createMultiSourceState();
state=updateSourceDraft(state,'S1',{sourceName:'Table 2 Model Data',sourceText:'PS NO\tDTXR\nPS-XYZ.1\tGUIDE'});
state=parseSourceDraft(state,'S1');
state=addSource(state,'Coordinate Lookup');
state=updateSourceDraft(state,'S2',{sourceName:'Coordinate Lookup',sourceText:'PS NO\tX\tY\tZ\nPS-XYZ.1\t1000\t2000\t3000'});
state=parseSourceDraft(state,'S2');
assert.equal(state.sources.length,2);
assert.equal(state.sources[0].rows[0].rowId,'S1:1');
assert.equal(state.sources[1].rows[0].rowId,'S2:1');
state=setActiveSource(state,'S1');
assert.equal(activeSource(state).sourceId,'S1');
state=setActiveSource(state,'S2');
assert.equal(activeSource(state).sourceId,'S2');
assert.equal(state.sources[0].rows.length,1,'switching active source preserves S1');

const context={rowId:'S1:1',sourceRows:{S1:state.sources[0].rows[0],S2:state.sources[1].rows[0]},sourceRefs:['S1:1','S2:1'],rawByHeader:{}};
assert.equal(runResolver({op:'trim',sourceId:'S1',column:'PS NO'},context).value,'PS-XYZ.1');
assert.equal(runResolver({op:'trim',sourceId:'S2',column:'X'},context).value,'1000');
const clusterContext={clusterState:{contract:{unit:'mm',axisMapping:{x:'X',y:'Y',z:'Z'},roundingPrecision:3,tolerance:2,clusterMethod:'max-axis-delta',originDatum:'source-global',coordinateSource:'sourceColumns',failurePolicy:'warn-and-fallback'},clusters:[]},diagnostics:[]};
assert.equal(runResolver({op:'coordinateCluster',sourceId:'S2',contract:{axisMapping:{x:'X',y:'Y',z:'Z'},unit:'mm',tolerance:2,roundingPrecision:3}},context,clusterContext).value,'C001');

console.log('xml-compare-table-categorized-multi-source: all assertions passed');
