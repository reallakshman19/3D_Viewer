import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_TABS, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from './table-categorized-xml-shell.js';

export const TABLE_CATEGORIZED_XML_CONTROLLER_SCHEMA='table-categorized-xml-controller/v1';

const SETUP_TAB_IDS=new Set(TABLE_CATEGORIZED_SETUP_TABS.map(([id])=>id));
const WORKFLOW_TAB_IDS=new Set(TABLE_CATEGORIZED_XML_TABS.map(([id])=>id));

export function nextTableCategorizedNavigationState(state={},action={}){
  if(action.type==='setup-tab'){
    const activeSetupTab=String(action.setupTab||'');
    if(!SETUP_TAB_IDS.has(activeSetupTab))return state;
    return {...state,activeSetupTab};
  }
  if(action.type==='workflow-tab'){
    const activeTab=String(action.activeTab||'');
    if(!WORKFLOW_TAB_IDS.has(activeTab))return state;
    return {...state,activeTab,activeSetupTab:setupTabForWorkflowTab(activeTab)};
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
