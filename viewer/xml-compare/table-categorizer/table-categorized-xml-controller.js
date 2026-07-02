import { createBlankUniversalProfile, cloneProfile, normalizeImportedProfile, parseProfileRecipeJson, serializeProfileRecipe } from './table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from './table-categorized-xml-pilot-profiles.js';
import { previewStageForSetupTab } from './table-categorized-xml-stage-preview.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_TABS, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from './table-categorized-xml-shell.js';

export const TABLE_CATEGORIZED_XML_CONTROLLER_SCHEMA='table-categorized-xml-controller/v4-recipe-management';

const SETUP_TAB_IDS=new Set(TABLE_CATEGORIZED_SETUP_TABS.map(([id])=>id));
const WORKFLOW_TAB_IDS=new Set(TABLE_CATEGORIZED_XML_TABS.map(([id])=>id));
const RECIPE_ACTIONS=new Set(['new-blank-profile','load-ps-template','load-two-source-template','reset-profile']);
const POPUP_SELECTOR='[data-xml-compare-table-categorized-popup]';
const ACTIVE_WORKFLOW_SELECTOR='[data-table-categorized-tab].is-active';
const ACTIVE_SETUP_SELECTOR='[data-table-categorized-setup-tab].is-active';

export function nextTableCategorizedNavigationState(state={},action={}){
  if(action.type==='setup-tab'){
    const activeSetupTab=String(action.setupTab||'');
    if(!SETUP_TAB_IDS.has(activeSetupTab))return state;
    return {...state,activeSetupTab,activePreviewStage:previewStageForSetupTab(activeSetupTab)};
  }
  if(action.type==='workflow-tab'){
    const activeTab=String(action.activeTab||'');
    if(!WORKFLOW_TAB_IDS.has(activeTab))return state;
    const activeSetupTab=setupTabForWorkflowTab(activeTab);
    return {...state,activeTab,activeSetupTab,activePreviewStage:previewStageForSetupTab(activeSetupTab)};
  }
  return state;
}

export function nextTableCategorizedRecipeState(state={},action={}){
  const recipeAction=String(action.action||action.recipeAction||'');
  if(!RECIPE_ACTIONS.has(recipeAction))return state;
  let profile;
  let diagnostics=[];
  if(recipeAction==='new-blank-profile')profile=createBlankUniversalProfile();
  if(recipeAction==='load-ps-template')profile=cloneProfile(PS_MAPPING_TABLE_2_SHADOW_PROFILE);
  if(recipeAction==='load-two-source-template')profile=cloneProfile(PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE);
  if(recipeAction==='reset-profile')profile=cloneProfile(state.defaultProfile||PS_MAPPING_TABLE_2_SHADOW_PROFILE);
  if(!profile)return state;
  diagnostics=[{severity:'INFO',code:`recipe_${recipeAction}`,message:`Recipe action completed: ${recipeAction}.`,ref:profile.profileId}];
  return stateWithProfileChange(state,profile,diagnostics);
}

export function nextTableCategorizedImportedProfileState(state={},jsonText='',fileName='recipe.json'){
  const parsed=parseProfileRecipeJson(jsonText);
  if(!parsed.ok){
    return {...state,profileMessages:parsed.diagnostics,profileImportName:fileName,activeSetupTab:state.activeSetupTab||'recipe',activePreviewStage:previewStageForSetupTab(state.activeSetupTab||'recipe')};
  }
  const normalized=normalizeImportedProfile(parsed.profile);
  return stateWithProfileChange(state,normalized.profile,[...parsed.diagnostics,...normalized.diagnostics,{severity:'INFO',code:'recipe_imported',message:`Recipe JSON imported: ${fileName}.`,ref:normalized.profile.profileId}],fileName);
}

export function buildProfileRecipeDownload(profile){
  const normalized=normalizeImportedProfile(profile||PS_MAPPING_TABLE_2_SHADOW_PROFILE);
  const profileId=normalized.profile.profileId||'recipe';
  return Object.freeze({
    filename:`table-categorized-recipe-${safeFilePart(profileId)}.json`,
    mimeType:'application/json',
    text:serializeProfileRecipe(normalized.profile),
    profile:normalized.profile
  });
}

export function triggerProfileRecipeDownload(download,doc=globalThis.document){
  if(!download||!doc?.createElement||typeof Blob==='undefined'||!globalThis.URL?.createObjectURL)return download;
  const blob=new Blob([download.text],{type:download.mimeType||'application/json'});
  const url=globalThis.URL.createObjectURL(blob);
  const anchor=doc.createElement('a');
  anchor.href=url;
  anchor.download=download.filename||'table-categorized-recipe.json';
  anchor.style.display='none';
  doc.body?.appendChild?.(anchor);
  anchor.click?.();
  anchor.remove?.();
  globalThis.URL.revokeObjectURL?.(url);
  return download;
}

export function tableCategorizedNavigationActionFromTarget(target){
  const setupButton=target?.closest?.('[data-table-categorized-setup-tab]');
  if(setupButton?.dataset?.tableCategorizedSetupTab){
    return {type:'setup-tab',setupTab:setupButton.dataset.tableCategorizedSetupTab};
  }
  const workflowButton=target?.closest?.('[data-table-categorized-tab]');
  if(workflowButton?.dataset?.tableCategorizedTab){
    return {type:'workflow-tab',activeTab:workflowButton.dataset.tableCategorizedTab};
  }
  const downloadButton=target?.closest?.('[data-table-categorized-download]');
  if(downloadButton?.dataset?.tableCategorizedDownload==='profile')return {type:'download-profile'};
  const actionButton=target?.closest?.('[data-table-categorized-action]');
  const recipeAction=actionButton?.dataset?.tableCategorizedAction;
  if(RECIPE_ACTIONS.has(recipeAction))return {type:'recipe-action',action:recipeAction};
  return null;
}

export function tableCategorizedNavigationStateFromPopup(popup,state={}){
  const activeTab=popup?.querySelector?.(ACTIVE_WORKFLOW_SELECTOR)?.dataset?.tableCategorizedTab||state.activeTab||'source';
  const activeSetupTab=popup?.querySelector?.(ACTIVE_SETUP_SELECTOR)?.dataset?.tableCategorizedSetupTab||state.activeSetupTab||setupTabForWorkflowTab(activeTab);
  const activePreviewStage=state.activePreviewStage||previewStageForSetupTab(activeSetupTab);
  return {...state,activeTab,activeSetupTab,activePreviewStage};
}

export function handleTableCategorizedNavigationClick(event,state={},render,options={}){
  const action=tableCategorizedNavigationActionFromTarget(event?.target);
  if(!action)return {handled:false,state};
  event.preventDefault?.();
  if(action.type==='download-profile'){
    const download=buildProfileRecipeDownload(state.profile||PS_MAPPING_TABLE_2_SHADOW_PROFILE);
    if(typeof options.downloadRecipe==='function')options.downloadRecipe(download);
    else triggerProfileRecipeDownload(download,options.document||globalThis.document);
    return {handled:true,state,action,download};
  }
  const nextState=action.type==='recipe-action'?nextTableCategorizedRecipeState(state,action):nextTableCategorizedNavigationState(state,action);
  render?.(nextState);
  return {handled:true,state:nextState,action};
}

export function handleTableCategorizedProfileFileImport(file,state={},render){
  if(!file?.text)return Promise.resolve({handled:false,state});
  return file.text().then((text)=>{
    const nextState=nextTableCategorizedImportedProfileState(state,text,file.name||'recipe.json');
    render?.(nextState);
    return {handled:true,state:nextState,fileName:file.name||'recipe.json'};
  });
}

export function wireTableCategorizedSetupTabNavigation(container,{state={},render,downloadRecipe}={}){
  let currentState={...state};
  const applyRender=(nextState)=>{
    currentState=nextState;
    if(typeof render==='function')render(nextState);
    else if(container)container.innerHTML=renderTableCategorizedXmlShellHtml(nextState);
  };
  const onClick=(event)=>{
    const result=handleTableCategorizedNavigationClick(event,currentState,applyRender,{downloadRecipe});
    if(result.handled)currentState=result.state;
  };
  const onChange=(event)=>{
    const input=event?.target?.closest?.('[data-table-categorized-profile-file]');
    if(!input)return;
    const file=input.files?.[0];
    if(!file)return;
    event.preventDefault?.();
    handleTableCategorizedProfileFileImport(file,currentState,applyRender).then((result)=>{if(result.handled)currentState=result.state;});
  };
  container?.addEventListener?.('click',onClick);
  container?.addEventListener?.('change',onChange);
  return {
    getState:()=>currentState,
    setState:(nextState={})=>{currentState={...nextState};},
    render:()=>applyRender(currentState),
    destroy:()=>{container?.removeEventListener?.('click',onClick);container?.removeEventListener?.('change',onChange);}
  };
}

export function installTableCategorizedSetupTabNavigation(root,initialState={}){
  if(!root?.addEventListener)return {destroy(){},getState:()=>({...initialState})};
  let currentState={...initialState};
  const renderPopup=(popup,nextState)=>{currentState=nextState;popup.outerHTML=renderTableCategorizedXmlShellHtml(nextState);};
  const onClick=(event)=>{
    const popup=event?.target?.closest?.(POPUP_SELECTOR);
    if(!popup)return;
    const popupState=tableCategorizedNavigationStateFromPopup(popup,currentState);
    const result=handleTableCategorizedNavigationClick(event,popupState,(nextState)=>renderPopup(popup,nextState));
    if(result.handled)currentState=result.state;
  };
  const onChange=(event)=>{
    const input=event?.target?.closest?.('[data-table-categorized-profile-file]');
    if(!input)return;
    const popup=event?.target?.closest?.(POPUP_SELECTOR);
    if(!popup)return;
    const file=input.files?.[0];
    if(!file)return;
    event.preventDefault?.();
    const popupState=tableCategorizedNavigationStateFromPopup(popup,currentState);
    handleTableCategorizedProfileFileImport(file,popupState,(nextState)=>renderPopup(popup,nextState)).then((result)=>{if(result.handled)currentState=result.state;});
  };
  root.addEventListener('click',onClick);
  root.addEventListener('change',onChange);
  return {
    getState:()=>currentState,
    destroy:()=>{root.removeEventListener?.('click',onClick);root.removeEventListener?.('change',onChange);}
  };
}

function stateWithProfileChange(state,profile,profileMessages=[],profileImportName=''){
  const activeSetupTab=state.activeSetupTab||'recipe';
  return {
    ...state,
    profile,
    profileMessages,
    profileImportName,
    graph:null,
    validationResults:[],
    exportResult:null,
    exportStatus:'',
    activeSetupTab,
    activePreviewStage:previewStageForSetupTab(activeSetupTab)
  };
}
function safeFilePart(value){return String(value||'recipe').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'recipe';}
