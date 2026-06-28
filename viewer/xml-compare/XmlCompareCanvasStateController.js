import { createXmlCompareNavigationState, reduceXmlCompareNavigationState } from './XmlCompareCanvasNavigation.js';
import { createXmlCompareFitCommand } from './XmlCompareFitController.js';
export const XML_COMPARE_CANVAS_STATE_CONTROLLER_SCHEMA='xml-compare-canvas-state-controller/v1';
const clean=(v)=>String(v??'').trim();
function log(code,message,side){return Object.freeze({ts:'',level:'info',code:clean(code),source:clean(side),message:clean(message)});}
function sideState(side,input={}){return createXmlCompareNavigationState({side,...input});}
export function createXmlCompareCanvasState(input={}){return Object.freeze({schema:XML_COMPARE_CANVAS_STATE_CONTROLLER_SCHEMA,source:sideState('source',input.source),target:sideState('target',input.target),logs:Object.freeze(input.logs||[]),fitCommands:Object.freeze(input.fitCommands||{})});}
export function applyXmlCompareCanvasAction(state={},action={}){const current=createXmlCompareCanvasState(state);const side=clean(action.side)==='target'?'target':'source';if(action.type==='set-mode'){const next=reduceXmlCompareNavigationState(current[side],{type:'SET_MODE',mode:action.mode});return createXmlCompareCanvasState({...current,[side]:next,logs:[...current.logs,log('XML-COMPARE-CANVAS-MODE',`${side} mode ${next.mode}`,side)]});}if(action.type==='fit-all'){const command=createXmlCompareFitCommand({side,records:action.records||[]});return createXmlCompareCanvasState({...current,fitCommands:{...current.fitCommands,[side]:command},logs:[...current.logs,log(command.ok?'XML-COMPARE-CANVAS-FIT-ALL':'XML-COMPARE-CANVAS-FIT-EMPTY',`${side} fit all ${command.ok?'ready':'empty'}`,side)]});}return current;}
export const _test=Object.freeze({clean,log,sideState});
