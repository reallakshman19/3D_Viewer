import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readRepoFile(relativePath) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readRepoFile(relativePath));
}

function assertFile(relativePath) {
  assert(existsSync(path.resolve(process.cwd(), relativePath)), `${relativePath} must exist.`);
}

function assertContains(fileText, needle, message) {
  assert(fileText.includes(needle), message || `Expected file to contain: ${needle}`);
}

const files = {
  runner: 'viewer/tabs/model-converters/converters/xmltocii2019_runner.js',
  previewUi: 'viewer/tabs/model-converters/xml-cii-matched-preview-ui.js',
  sideloadUi: 'viewer/tabs/model-converters/xml-cii-sideload-ui.js',
  jsonConfigUi: 'viewer/tabs/model-converters/xml-cii-sideload-json-config-tools.js',
  jsonConfigCore: 'viewer/converters/xml-cii2019-core/sideload-json-config.js',
  resolverCore: 'viewer/converters/xml-cii2019-core/sideload-resolver.js',
  ledgerCore: 'viewer/converters/xml-cii2019-core/sideload-ledger.js',
  restraintsCore: 'viewer/converters/xml-cii2019-core/sideload-restraints.js',
  applyCore: 'viewer/converters/xml-cii2019-core/sideload-apply.js',
  benchmarkXml: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.input.xml',
  benchmarkSourceJson: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.source-like.json',
  benchmarkJsonConfig: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.json-config.json',
  benchmarkSideload: 'Benchmarks/XML-CII-2019/sideload/bm_3branches_20nodes.sideload-restraints.txt',
};

for (const relativePath of Object.values(files)) assertFile(relativePath);

const runner = readRepoFile(files.runner);
const previewUi = readRepoFile(files.previewUi);
const sideloadUi = readRepoFile(files.sideloadUi);
const jsonConfigUi = readRepoFile(files.jsonConfigUi);
const jsonConfigCore = readRepoFile(files.jsonConfigCore);
const resolverCore = readRepoFile(files.resolverCore);
const ledgerCore = readRepoFile(files.ledgerCore);
const restraintsCore = readRepoFile(files.restraintsCore);
const applyCore = readRepoFile(files.applyCore);

const eventName = 'xml-cii-matched-preview:diagnostics';
const storageKey = 'xmlCii2019.matchedPreview.lastDiagnostics.v1';

assertContains(runner, eventName, 'Runner must publish the Matched Preview diagnostics event.');
assertContains(previewUi, eventName, 'Matched Preview UI must listen to the same diagnostics event.');
assertContains(runner, storageKey, 'Runner must write the latest-run diagnostics storage key.');
assertContains(previewUi, storageKey, 'Matched Preview UI must read the latest-run diagnostics storage key.');
assertContains(runner, 'publishMatchedPreviewDiagnostics(diagnosticPayload)', 'Runner must publish exactly the diagnostics payload sent to output JSON.');
assertContains(runner, 'ensureEnrichedPreviewLedger(enriched)', 'Runner must populate preview ledger before sideload and diagnostics output.');
assertContains(runner, 'applyOptionalManualSideload(enriched, runValues)', 'Runner must apply optional manual sideload before CII conversion.');
assertContains(runner, 'matchedFacts: enriched.matchedFacts || []', 'Runner diagnostics payload must include matchedFacts.');
assertContains(runner, 'rejectedFacts: enriched.rejectedFacts || []', 'Runner diagnostics payload must include rejectedFacts.');
assertContains(previewUi, "fact?.status === 'MATCHED'", 'Matched Preview UI must filter to matched-only rows.');
assertContains(previewUi, 'Rejected hidden', 'Matched Preview summary must explicitly count hidden rejected rows.');
assertContains(previewUi, 'Refresh Latest Run', 'Matched Preview must keep latest-run refresh fallback.');

for (const label of ['Resolver Index', 'JSON Config', 'JSON Resolved Data', 'PS → Node', 'POS → Node', 'Restraints', 'Diagnostics']) {
  assertContains(sideloadUi, label, `Sideload UI must expose ${label} sub-tab.`);
}

for (const label of ['Import Config', 'Export Config', 'Save Advanced Fields']) {
  assertContains(jsonConfigUi, label, `JSON Config tools must expose ${label}.`);
}

for (const itemType of ['RESTRAINT', 'DTXR_PS', 'DTXR_POS', 'WEIGHT', 'RATING', 'RESTRAINT_META']) {
  assertContains(jsonConfigCore, itemType, `Default JSON Config must include ${itemType}.`);
}
for (const alias of ['SUPPORT_TAG', 'CMPSTRESSN', 'CMPSUPREFN', 'POS', 'APOS', 'LPOS', 'POSI', 'ABOP', 'LBOP']) {
  assertContains(jsonConfigCore, alias, `Default JSON Config must include alias ${alias}.`);
}

for (const exportName of ['buildXmlCiiNodeResolverIndex', 'resolveXmlCiiPsToNode', 'resolveXmlCiiPositionToNode', 'normalizePsKey', 'parseXmlCiiPosition']) {
  assertContains(resolverCore, `export function ${exportName}`, `Resolver core must export ${exportName}.`);
}
for (const exportName of ['makeXmlCiiMatchedFact', 'makeXmlCiiRejectedFact', 'mergeXmlCiiMatchedFacts', 'matchedFactsFromEnrichmentDiagnostics']) {
  assertContains(ledgerCore, `export function ${exportName}`, `Ledger core must export ${exportName}.`);
}
for (const exportName of ['parseXmlCiiManualRestraintRows', 'resolveManualRestraintRows', 'normalizeXmlCiiManualRestraint']) {
  assertContains(restraintsCore, `export function ${exportName}`, `Manual restraints core must export ${exportName}.`);
}
assertContains(applyCore, "setAttribute('source', 'MANUAL_SIDELOAD')", 'Manual apply must tag injected XML restraints as MANUAL_SIDELOAD.');
assertContains(applyCore, "fact?.source !== 'MANUAL_SIDELOAD'", 'Manual apply must ignore non-manual facts.');
assertContains(applyCore, "fact?.itemType !== 'RESTRAINT'", 'Manual apply must only apply restraint facts.');
assertContains(applyCore, "fact?.status !== 'MATCHED'", 'Manual apply must only apply matched facts.');

const benchmarkSource = readJson(files.benchmarkSourceJson);
const benchmarkConfig = readJson(files.benchmarkJsonConfig);
const sideloadText = readRepoFile(files.benchmarkSideload);
const benchmarkXml = readRepoFile(files.benchmarkXml);

assert(Array.isArray(benchmarkSource) && benchmarkSource.length === 3, 'Source-like benchmark JSON must contain 3 branches.');
assert(benchmarkSource.reduce((sum, branch) => sum + (Array.isArray(branch.children) ? branch.children.length : 0), 0) >= 20, 'Source-like benchmark must contain at least 20 child items.');
assert(benchmarkConfig?.basisResolvers?.PS?.fieldAliases?.includes('SUPPORT_TAG'), 'Benchmark JSON Config must map PS from SUPPORT_TAG.');
assert(benchmarkConfig?.basisResolvers?.POS?.objectFieldAliases?.includes('POS'), 'Benchmark JSON Config must map POS object fields.');
assert(benchmarkConfig?.basisResolvers?.POS?.textFieldAliases?.includes('POSI'), 'Benchmark JSON Config must map POSI text coordinates.');
assert(benchmarkConfig?.itemExtractors?.RESTRAINT?.sourceFieldAliases?.includes('SUPPORT_KIND'), 'Benchmark JSON Config must map restraint kind aliases.');
assert(sideloadText.includes('Node|PSNo.|POS|Restraint'), 'Sideload benchmark must include tabular header.');
assert(sideloadText.includes('PS-Z-999'), 'Sideload benchmark must include unresolved PS diagnostic row.');
assert(sideloadText.includes('FooBar'), 'Sideload benchmark must include invalid restraint diagnostic row.');
assert(/<NodeNumber>\s*60\s*<\/NodeNumber>/.test(benchmarkXml), 'Benchmark XML must include Node 60 for ANCI/component regression.');
assert(/<ComponentType>\s*ANCI\s*<\/ComponentType>/.test(benchmarkXml), 'Benchmark XML must include ANCI component regression case.');

console.log('PASS: XML→CII sideload, diagnostics, and Matched Preview static chain is wired.');
