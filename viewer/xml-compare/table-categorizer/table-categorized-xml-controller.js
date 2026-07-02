import { previewStageForSetupTab } from './table-categorized-xml-stage-preview.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_TABS, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from './table-categorized-xml-shell.js';

export const TABLE_CATEGORIZED_XML_CONTROLLER_SCHEMA='table-categorized-xml-controller/v3';

const SETUP_TAB_IDS=new Set(TABLE_CATEGORIZED_SETUP_TABS.map(([id])=>id));
const WORKFLOW_TAB_IDS=new Set(TABLE_CATEGORIZED_XML_TABS.map(([id])=>id));
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

export function tableCategorizedNavigationActionFromTarget(target){
  const setupButton=target?.closest?.('[data-table-categorized-setup-tab]');
  if(setupButton?.dataset?.tableCategorizedSetupTab){
    return {type:'setup-tab',setupTab:setupButton.dataset.tableCategorizedSetupTab};
  }
  const workflowButton=target?.closest?.('[data-table-categorized-tab]');
  if(workflowButton?.dataset?.tableCategorizedTab){
    return {type:'workflow-tab',activeTab:workflowButton.dataset.tableCategorizedTab};
  }
  return null;
}

export function tableCategorizedNavigationStateFromPopup(popup,state={}){
  const activeTab=popup?.querySelector?.(ACTIVE_WORKFLOW_SELECTOR)?.dataset?.tableCategorizedTab||state.activeTab||'source';
  const activeSetupTab=popup?.querySelector?.(ACTIVE_SETUP_SELECTOR)?.dataset?.tableCategorizedSetupTab||state.activeSetupTab||setupTabForWorkflowTab(activeTab);
  const activePreviewStage=state.activePreviewStage||previewStageForSetupTab(activeSetupTab);
  return {...state,activeTab,activeSetupTab,activePreviewStage};
}

export function handleTableCategorizedNavigationClick(event,state={},render){
  const action=tableCategorizedNavigationActionFromTarget(event?.target);
  if(!action)return {handled:false,state};
  event.preventDefault?.();
  const nextState=nextTableCategorizedNavigationState(state,action);
  render?.(nextState);
  return {handled:true,state:nextState,action};
}

export function wireTableCategorizedSetupTabNavigation(container,{state={},render}={}){
  let currentState={...state};
  const applyRender=(nextState)=>{
    currentState=nextState;
    if(typeof render==='function')render(nextState);
    else if(container)container.innerHTML=renderTableCategorizedXmlShellHtml(nextState);
  };
  const onClick=(event)=>{
    const result=handleTableCategorizedNavigationClick(event,currentState,applyRender);
    if(result.handled)currentState=result.state;
  };
  container?.addEventListener?.('click',onClick);
  return {
    getState:()=>currentState,
    setState:(nextState={})=>{currentState={...nextState};},
    render:()=>applyRender(currentState),
    destroy:()=>container?.removeEventListener?.('click',onClick)
  };
}

export function installTableCategorizedSetupTabNavigation(root,initialState={}){
  if(!root?.addEventListener)return {destroy(){},getState:()=>({...initialState})};
  let currentState={...initialState};
  const onClick=(event)=>{
    const popup=event?.target?.closest?.(POPUP_SELECTOR);
    if(!popup)return;
    const popupState=tableCategorizedNavigationStateFromPopup(popup,currentState);
    const result=handleTableCategorizedNavigationClick(event,popupState,(nextState)=>{
      currentState=nextState;
      popup.outerHTML=renderTableCategorizedXmlShellHtml(nextState);
    });
    if(result.handled)currentState=result.state;
  };
  root.addEventListener('click',onClick);
  return {
    getState:()=>currentState,
    destroy:()=>root.removeEventListener?.('click',onClick)
  };
}
