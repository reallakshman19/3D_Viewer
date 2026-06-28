import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const XML_COMPARE_ARCHITECTURE_GATE_SCHEMA='xml-compare-architecture-gate/v1';
const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const XML_COMPARE_DIR=path.join(ROOT,'viewer/xml-compare');
const MAX_MODULE_LINES=300;
const REQUIRED_LOG_EXPORTS=Object.freeze(['XML_COMPARE_LOG_SCREEN_SCHEMA','XML_COMPARE_LOG_LEVELS','createXmlCompareLogStore','createXmlCompareLogEntry','appendXmlCompareLogEntry','renderXmlCompareLogScreenHtml']);
const BANNED_PATTERNS=Object.freeze([
  {label:'window-global-runtime',pattern:/window\s*\.\s*__/},
  {label:'global-runtime-mutation',pattern:/globalThis\s*\.\s*__/},
  {label:'prototype-mutation',pattern:/\.prototype\s*\./},
  {label:'define-property-mutation',pattern:/Object\.defineProperty\s*\(/},
  {label:'mutation-observer-patch',pattern:/\bMutationObserver\b/},
  {label:'console-bypass-log-screen',pattern:/\bconsole\s*\./},
  {label:'shim-language',pattern:/\bshim\b/i},
  {label:'wrapper-language',pattern:/\bwrapper\b/i},
  {label:'injection-language',pattern:/\binject(?:ion|ed|ing)?\b/i},
  {label:'monkey-patch-language',pattern:/\bmonkey\b/i},
  {label:'runtime-mutation-language',pattern:/runtime\s+mutation/i},
]);
function read(file){return fs.readFileSync(file,'utf8');}
function rel(file){return path.relative(ROOT,file).replaceAll(path.sep,'/');}
function lineCount(text){return text.split(/\r?\n/).length;}
function xmlCompareModules(){if(!fs.existsSync(XML_COMPARE_DIR))return[];return fs.readdirSync(XML_COMPARE_DIR).filter((name)=>/^XmlCompare.*\.js$/.test(name)).map((name)=>path.join(XML_COMPARE_DIR,name)).sort();}
function assertModuleShape(file,text,failures){const lines=lineCount(text);if(lines>MAX_MODULE_LINES)failures.push(`${rel(file)} exceeds ${MAX_MODULE_LINES} lines (${lines})`);if(!/XML_COMPARE_[A-Z0-9_]*_SCHEMA/.test(text))failures.push(`${rel(file)} must export an XML_COMPARE_*_SCHEMA constant`);for(const rule of BANNED_PATTERNS){if(rule.pattern.test(text))failures.push(`${rel(file)} violates ${rule.label}`);}}
function assertLogScreenContract(failures){const file=path.join(XML_COMPARE_DIR,'XmlCompareLogScreen.js');if(!fs.existsSync(file)){failures.push('viewer/xml-compare/XmlCompareLogScreen.js is required for log-screen diagnostics');return;}const text=read(file);for(const marker of REQUIRED_LOG_EXPORTS){if(!text.includes(marker))failures.push(`${rel(file)} missing ${marker}`);}}
export function runXmlCompareArchitectureGate(){const failures=[];const modules=xmlCompareModules();if(!modules.length)failures.push('No first-class XmlCompare*.js modules found');for(const file of modules)assertModuleShape(file,read(file),failures);assertLogScreenContract(failures);const result={schema:XML_COMPARE_ARCHITECTURE_GATE_SCHEMA,ok:failures.length===0,checkedModuleCount:modules.length,maxModuleLines:MAX_MODULE_LINES,failures};if(!result.ok){const error=new Error(`XML Compare architecture gate failed:\n${failures.join('\n')}`);error.result=result;throw error;}return result;}
export function assertXmlCompareArchitectureGate(){return runXmlCompareArchitectureGate();}
if(import.meta.url===`file://${process.argv[1]}`){const result=runXmlCompareArchitectureGate();process.stdout.write(`XML Compare architecture gate: PASS (${result.checkedModuleCount} modules, max ${result.maxModuleLines} lines)\n`);}
