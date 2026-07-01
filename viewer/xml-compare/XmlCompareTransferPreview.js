export const XML_COMPARE_TRANSFER_PREVIEW_SCHEMA='xml-compare-transfer-preview/v1';
const SKIP=new Set(['uid','raw','points','position','baseRecords','hierarchy','levelProfile','levelView','intake','adapter','diagnostics']);
const clean=(v)=>String(v??'').trim();
function scalar(value){if(value==null)return '';if(typeof value==='object')return '';return clean(value);}
function byUid(records=[],uid=''){return (records||[]).find((record)=>clean(record.uid)===clean(uid))||null;}
function fields(record={}){return Object.freeze(Object.keys(record||{}).filter((field)=>!SKIP.has(field)&&scalar(record[field])));}
function changed(sourceValue='',targetValue=''){return scalar(sourceValue)&&scalar(sourceValue)!==scalar(targetValue);}
function previewRows(sourceRecord={},targetRecord={},connector={}){const rows=[];for(const field of fields(sourceRecord)){const sourceValue=scalar(sourceRecord[field]),targetValue=scalar(targetRecord?.[field]);if(!changed(sourceValue,targetValue))continue;rows.push(Object.freeze({id:`transfer:${clean(connector.id)}:${field}`,connectorId:clean(connector.id),sourceUid:clean(connector.sourceUid),targetUid:clean(connector.targetUid),field,sourceValue,targetValue,status:targetValue?'different':'missing-target-value'}));}return Object.freeze(rows);}
export function createXmlCompareTransferPreview({source=null,target=null,manualConnectors=[]}={}){const rows=[];for(const connector of manualConnectors||[]){const sourceRecord=byUid(source?.records||[],connector.sourceUid),targetRecord=byUid(target?.records||[],connector.targetUid);if(!sourceRecord||!targetRecord)continue;rows.push(...previewRows(sourceRecord,targetRecord,connector));}return Object.freeze({schema:XML_COMPARE_TRANSFER_PREVIEW_SCHEMA,rows:Object.freeze(rows),summary:Object.freeze({connectorCount:(manualConnectors||[]).length,previewCount:rows.length})});}
export const _test=Object.freeze({clean,scalar,byUid,fields,changed,previewRows});
