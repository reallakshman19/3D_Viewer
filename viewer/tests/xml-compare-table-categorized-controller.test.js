import assert from 'node:assert/strict';

import { handleTableCategorizedNavigationClick, nextTableCategorizedNavigationState, tableCategorizedNavigationStateFromPopup } from '../xml-compare/table-categorizer/table-categorized-xml-controller.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';

const fakeTarget=(selector,dataset)=>({closest:(query)=>query===selector?{dataset}:null});
const fakePopupWithDraft=()=>({
  querySelector(selector){
    if(selector==='[data-table-categorized-tab].is-active')return {dataset:{tableCategorizedTab:'source'}};
    if(selector==='[data-table-categorized-setup-tab].is-active')return {dataset:{tableCategorizedSetupTab:'source'}};
    if(selector==='[data-table-categorized-active-source]')return {value:'S1'};
    if(selector==='[data-table-categorized-source-name]')return {value:'Manual Table'};
    if(selector==='[data-table-categorized-source-text]')return {value:'PS NO\tDTXR\nPS-AAA.1\tGUIDE'};
    return null;
  }
});

const loaded=nextTableCategorizedNavigationState({}, {type:'source-action',action:'load-sample'});
assert.equal(loaded.activeTab,'source');
assert.equal(loaded.activeSetupTab,'source');
assert.equal(loaded.activePreviewStage,'raw');
assert.equal(loaded.activeSourceId,'S1');
assert.equal(loaded.sources.length,1);
assert.equal(loaded.sources[0].rows.length,6);
assert.equal(loaded.sources[0].headers.includes('PS NO'),true);
assert.equal(loaded.profile.profileId,'ps-mapping-table-2-shadow-profile');

const fields=nextTableCategorizedNavigationState(loaded,{type:'setup-tab',setupTab:'fields'});
assert.equal(fields.activeSetupTab,'fields');
assert.equal(fields.activePreviewStage,'base');
assert.equal(fields.sources[0].rows.length,6);
assert.equal(fields.profile.profileId,'ps-mapping-table-2-shadow-profile');
const fieldsHtml=renderTableCategorizedXmlShellHtml(fields);
assert.ok(fieldsHtml.includes('data-table-categorized-setup-tab="source"'));
assert.ok(fieldsHtml.includes('data-table-categorized-status="ready"'));
assert.ok(fieldsHtml.includes('Column Mapping Proof'));
assert.ok(!fieldsHtml.includes('>pending<'));

const graphState=nextTableCategorizedNavigationState(loaded,{type:'source-action',action:'build-graph'});
assert.equal(graphState.activeTab,'graph');
assert.equal(graphState.activeSetupTab,'structure');
assert.ok(graphState.graph?.nodes?.length>0);
assert.ok(Array.isArray(graphState.validationResults));
assert.ok(graphState.exportResult);

const twoSource=nextTableCategorizedNavigationState({}, {type:'source-action',action:'load-coordinate-sample'});
assert.equal(twoSource.sources.length,2);
assert.equal(twoSource.sources[0].sourceId,'S1');
assert.equal(twoSource.sources[1].sourceId,'S2');
assert.equal(twoSource.profile.profileId,'ps-mapping-table-2-coordinate-lookup-profile');

const parsed=nextTableCategorizedNavigationState({sources:[{sourceId:'S1',sourceName:'Draft',sourceText:'PS NO\tDTXR\nPS-BBB.1\tREST',headers:[],rows:[],diagnostics:[]}],activeSourceId:'S1'}, {type:'source-action',action:'parse'});
assert.equal(parsed.sources[0].rows.length,1);
assert.equal(parsed.sources[0].rows[0].rawByHeader['PS NO'],'PS-BBB.1');

const popupState=tableCategorizedNavigationStateFromPopup(fakePopupWithDraft(), {sources:[{sourceId:'S1',sourceName:'Old',sourceText:'',headers:[],rows:[],diagnostics:[]}],activeSourceId:'S1'});
assert.equal(popupState.sources[0].sourceName,'Manual Table');
assert.equal(popupState.sources[0].sourceText,'PS NO\tDTXR\nPS-AAA.1\tGUIDE');

let rendered='';
const result=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-action]',{tableCategorizedAction:'load-sample'}),preventDefault(){}},{},(next)=>{rendered=renderTableCategorizedXmlShellHtml(next);});
assert.equal(result.handled,true);
assert.equal(result.state.sources[0].rows.length,6);
assert.ok(rendered.includes('PS Mapping Table 2 Sample'));

console.log('xml-compare-table-categorized-controller: all assertions passed');
