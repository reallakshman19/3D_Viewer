export const TABLE_CATEGORIZED_XML_SOURCE_PARSER_SCHEMA='table-categorized-xml-source-parser/v1';

const DELIMITER_CANDIDATES=Object.freeze([
  {id:'tab',label:'tab'},
  {id:'comma',label:'comma'},
  {id:'pipe',label:'pipe'},
  {id:'whitespace',label:'multiple spaces'}
]);

const cleanLine=(line)=>String(line??'').replace(/\r$/,'');
const isBlank=(line)=>cleanLine(line).trim()==='';

export function parseTableSource(text,options={}){
  const cfg=sourceConfig(options);
  const lines=String(text??'').replace(/^\uFEFF/,'').split('\n').map(cleanLine);
  const contentLines=lines.filter((line)=>!isBlank(line));
  const blankRowsSkipped=lines.length-contentLines.length;
  if(!contentLines.length)return emptySource(cfg,blankRowsSkipped);
  const delimiter=detectTableDelimiter(contentLines);
  const parsedLines=contentLines.map((line)=>splitTableLine(line,delimiter.id));
  const headers=cfg.firstRowIsHeader?parsedLines[0]||[]:defaultHeaders(parsedLines[0]?.length||0);
  const rowLines=cfg.firstRowIsHeader?parsedLines.slice(1):parsedLines;
  const rows=rowLines.map((cells,index)=>buildRow(cfg.sourceId,index+1,headers,cells));
  const diagnostics=buildDiagnostics({headers,rows,delimiter,blankRowsSkipped});
  return Object.freeze({
    sourceId:cfg.sourceId,
    sourceName:cfg.sourceName,
    sourceType:cfg.sourceType,
    delimiter:delimiter.id,
    delimiterLabel:delimiter.label,
    headers:Object.freeze(headers),
    rows:Object.freeze(rows),
    diagnostics:Object.freeze(diagnostics)
  });
}

export function detectTableDelimiter(lines){
  const sample=Array.isArray(lines)?lines.filter((line)=>!isBlank(line)).slice(0,10):[];
  if(!sample.length)return DELIMITER_CANDIDATES[0];
  const scores=DELIMITER_CANDIDATES.map((candidate)=>scoreDelimiter(sample,candidate));
  scores.sort((a,b)=>b.score-a.score || candidateRank(a.id)-candidateRank(b.id));
  return Object.freeze({id:scores[0].id,label:scores[0].label});
}

export function splitTableLine(line,delimiter){
  const value=cleanLine(line);
  if(delimiter==='comma')return splitCsvLine(value);
  if(delimiter==='tab')return value.split('\t');
  if(delimiter==='pipe')return value.split('|');
  return splitWhitespaceLine(value);
}

export function buildSourceSummary(source){
  const headers=Array.isArray(source?.headers)?source.headers:[];
  const rows=Array.isArray(source?.rows)?source.rows:[];
  const warnings=(source?.diagnostics||[]).filter((d)=>d.severity==='WARNING').length;
  const errors=(source?.diagnostics||[]).filter((d)=>d.severity==='ERROR').length;
  return Object.freeze({
    sourceId:String(source?.sourceId||''),
    sourceName:String(source?.sourceName||''),
    rows:rows.length,
    columns:headers.length,
    status:errors?'Error':warnings?'Parsed with warnings':'Parsed'
  });
}

function sourceConfig(options){
  return Object.freeze({
    sourceId:String(options.sourceId||'S1'),
    sourceName:String(options.sourceName||'Pasted Source 1'),
    sourceType:String(options.sourceType||'pasteText'),
    firstRowIsHeader:options.firstRowIsHeader!==false
  });
}

function emptySource(cfg,blankRowsSkipped){
  return Object.freeze({
    sourceId:cfg.sourceId,
    sourceName:cfg.sourceName,
    sourceType:cfg.sourceType,
    delimiter:'none',
    delimiterLabel:'none',
    headers:Object.freeze([]),
    rows:Object.freeze([]),
    diagnostics:Object.freeze([
      diagnostic('ERROR','empty_input','No table text was provided.'),
      diagnostic('INFO','blank_rows_skipped',`${blankRowsSkipped} blank row(s) skipped.`,{blankRowsSkipped})
    ])
  });
}

function scoreDelimiter(lines,candidate){
  const counts=lines.map((line)=>splitTableLine(line,candidate.id).length);
  const multi=counts.filter((count)=>count>1).length;
  const expected=modeCount(counts);
  const mismatches=counts.filter((count)=>count!==expected).length;
  const width=expected>1?expected:0;
  const explicitBonus=explicitDelimiterSeen(lines,candidate.id)?1000:0;
  return {id:candidate.id,label:candidate.label,score:explicitBonus+(multi*100)+(width*10)-mismatches};
}

function explicitDelimiterSeen(lines,id){
  if(id==='tab')return lines.some((line)=>line.includes('\t'));
  if(id==='comma')return lines.some((line)=>line.includes(','));
  if(id==='pipe')return lines.some((line)=>line.includes('|'));
  return false;
}

function candidateRank(id){
  return ['tab','comma','pipe','whitespace'].indexOf(id);
}

function modeCount(counts){
  const tally=new Map();
  counts.forEach((count)=>tally.set(count,(tally.get(count)||0)+1));
  return [...tally.entries()].sort((a,b)=>b[1]-a[1] || b[0]-a[0])[0]?.[0]||0;
}

function splitCsvLine(line){
  const cells=[];
  let cell='',quoted=false;
  for(let i=0;i<line.length;i+=1){
    const char=line[i],next=line[i+1];
    if(char==='"'&&quoted&&next==='"'){cell+='"';i+=1;continue;}
    if(char==='"'){quoted=!quoted;continue;}
    if(char===','&&!quoted){cells.push(cell);cell='';continue;}
    cell+=char;
  }
  cells.push(cell);
  return cells;
}

function splitWhitespaceLine(line){
  const trimmed=line.trim();
  if(!trimmed)return [''];
  const separator=/\s{2,}/.test(trimmed)?/\s{2,}/:/\s+/;
  return trimmed.split(separator);
}

function defaultHeaders(count){
  return Array.from({length:count},(_,index)=>`Column ${index+1}`);
}

function buildRow(sourceId,index,headers,cells){
  const rawCells=Object.freeze([...cells]);
  const rawByHeader={};
  headers.forEach((header,cellIndex)=>{rawByHeader[header]=rawCells[cellIndex]??'';});
  return Object.freeze({
    rowId:`${sourceId}:${index}`,
    rawCells,
    rawByHeader:Object.freeze(rawByHeader)
  });
}

function buildDiagnostics({headers,rows,delimiter,blankRowsSkipped}){
  const diagnostics=[
    diagnostic(headers.length?'PASS':'ERROR','header_detected',headers.length?'Header row detected.':'Header row is empty.',{headerCount:headers.length}),
    diagnostic(rows.length?'PASS':'WARNING','rows_parsed',`${rows.length} data row(s) parsed.`,{rowCount:rows.length}),
    diagnostic('INFO',`delimiter=${delimiter.id}`,`Delimiter detected: ${delimiter.label}.`,{delimiter:delimiter.id}),
    diagnostic('INFO','blank_rows_skipped',`${blankRowsSkipped} blank row(s) skipped.`,{blankRowsSkipped})
  ];
  return diagnostics.concat(columnCountDiagnostics(headers,rows));
}

function columnCountDiagnostics(headers,rows){
  return rows.flatMap((row,index)=>{
    if(row.rawCells.length===headers.length)return [];
    const code=`row_${index+1}_column_count_mismatch`;
    const msg=`Row ${index+1} has ${row.rawCells.length} cell(s); expected ${headers.length}.`;
    return [diagnostic('WARNING',code,msg,{rowId:row.rowId,expected:headers.length,actual:row.rawCells.length})];
  });
}

function diagnostic(severity,code,message,details={}){
  return Object.freeze({severity,code,message,details:Object.freeze({...details})});
}
