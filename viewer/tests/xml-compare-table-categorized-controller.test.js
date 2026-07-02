import assert from 'node:assert/strict';

import { buildProfileRecipeDownload, handleTableCategorizedNavigationClick, handleTableCategorizedProfileFileImport, nextTableCategorizedImportedProfileState, nextTableCategorizedRecipeState } from '../xml-compare/table-categorizer/table-categorized-xml-controller.js';
import { createBlankUniversalProfile, serializeProfileRecipe } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';

const fakeTarget=(selector,dataset)=>({closest:(query)=>query===selector?{dataset}:null});
const source={sourceId:'S1',rows:[{rowId:'r1'}]};
const baseState={activeTab:'levels',activeSetupTab:'recipe',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph:{nodes:[]},exportResult:{ok:true},validationResults:[{severity:'INFO'}],compareCanvas:{status:'keep-me'}};

let next=nextTableCategorizedRecipeState(baseState,{action:'new-blank-profile'});
assert.equal(next.profile.profileId,'blank-universal-profile');
assert.equal(next.graph,null);
assert.equal(next.exportResult,null);
assert.deepEqual(next.validationResults,[]);
assert.equal(next.sources,baseState.sources,'profile changes do not mutate or replace sources');
assert.equal(next.compareCanvas,baseState.compareCanvas,'compare canvas is preserved');
assert.equal(next.activeSetupTab,'recipe');
assert.equal(next.activePreviewStage,'base');

next=nextTableCategorizedRecipeState(baseState,{action:'load-ps-template'});
assert.equal(next.profile.profileId,PS_MAPPING_TABLE_2_SHADOW_PROFILE.profileId);
next=nextTableCategorizedRecipeState(baseState,{action:'load-two-source-template'});
assert.equal(next.profile.profileId,PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE.profileId);
next=nextTableCategorizedRecipeState({...baseState,defaultProfile:createBlankUniversalProfile()},{action:'reset-profile'});
assert.equal(next.profile.profileId,'blank-universal-profile');

const invalid=nextTableCategorizedImportedProfileState(baseState,'{bad','bad.json');
assert.equal(invalid.profile,baseState.profile,'invalid import keeps existing profile');
assert.ok(invalid.profileMessages.some((item)=>item.code==='imported-invalid'));
const validText=serializeProfileRecipe({profileId:'imported-profile',displayName:'Imported Profile',levelDefinitions:[],rootPartitions:[],joins:[]});
const imported=nextTableCategorizedImportedProfileState(baseState,validText,'good.json');
assert.equal(imported.profile.profileId,'imported-profile');
assert.equal(imported.graph,null);
assert.equal(imported.exportResult,null);
assert.equal(imported.profileImportName,'good.json');
assert.ok(imported.profileMessages.some((item)=>item.code==='recipe_imported'));

const download=buildProfileRecipeDownload(PS_MAPPING_TABLE_2_SHADOW_PROFILE);
assert.equal(download.filename,'table-categorized-recipe-ps-mapping-table-2-shadow-profile.json');
assert.equal(download.mimeType,'application/json');
assert.ok(download.text.includes('"profileId": "ps-mapping-table-2-shadow-profile"'));
assert.ok(!download.text.includes('<CategorizedTableXml'));

let renderedState=null;
const actionResult=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-action]',{tableCategorizedAction:'new-blank-profile'}),preventDefault(){}},baseState,(state)=>{renderedState=state;});
assert.equal(actionResult.handled,true);
assert.equal(actionResult.state.profile.profileId,'blank-universal-profile');
assert.equal(renderedState.profile.profileId,'blank-universal-profile');
assert.ok(!JSON.stringify(actionResult.state).includes('send-source'));
assert.ok(!JSON.stringify(actionResult.state).includes('send-target'));

let capturedDownload=null;
const downloadResult=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-download]',{tableCategorizedDownload:'profile'}),preventDefault(){}},baseState,null,{downloadRecipe:(item)=>{capturedDownload=item;}});
assert.equal(downloadResult.handled,true);
assert.equal(capturedDownload.filename,'table-categorized-recipe-ps-mapping-table-2-shadow-profile.json');
assert.equal(downloadResult.download.text,capturedDownload.text);

const file={name:'imported.json',text:()=>Promise.resolve(validText)};
const fileResult=await handleTableCategorizedProfileFileImport(file,baseState,(state)=>{renderedState=state;});
assert.equal(fileResult.handled,true);
assert.equal(fileResult.state.profile.profileId,'imported-profile');
assert.equal(renderedState.profile.profileId,'imported-profile');

console.log('xml-compare-table-categorized-controller: all assertions passed');
