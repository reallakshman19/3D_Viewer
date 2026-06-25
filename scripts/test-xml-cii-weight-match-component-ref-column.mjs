#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const renderer = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js');
const preview = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/preview-renderer.js');
const dtxrWall = read('viewer/converters/xml-cii2019-core/dtxr-wall-thickness-resolver.js');
const nativePanels = read('viewer/tabs/model-converters/xml-cii-popup-native-panels.js');
const bridge = read('viewer/tabs/model-converters/xml-cii-workflow-bridge.js');
const stagedGeometry = read('viewer/converters/xml-cii2019-core/staged-geometry-authority.js');
const config = read('viewer/converters/xml-cii2019-core/config.js');
const sideloadConfig = read('viewer/converters/xml-cii2019-core/sideload-json-config.js');
const branchSample = read('viewer/tabs/model-converters/xml-cii-branch-sample-sync.js');
const branchResolver = read('viewer/converters/xml-cii2019-core/branch-process-resolver.js');
const previewTable = read('viewer/tabs/model-converters/shared/EditablePreviewTable.js');
const runParity = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js');
const openRegex = read('viewer/tabs/model-converters/xml-cii-workflow-open-regex.js');

function assert(condition, message) { if (!condition) { console.error('FAIL: ' + message); process.exit(1); } }

assert(/ComponentType/.test(renderer), 'Workflow 4A table must show ComponentType');
assert(/ComponentRefNo_Endpoint/.test(renderer), 'Workflow 4A table must show ComponentRefNo_Endpoint');
assert(/componentRefEndpoint/.test(renderer), 'Workflow 4A row renderer must output componentRefEndpoint');
assert(/Endpoint/.test(renderer), 'Workflow 4A renderer must read XML Endpoint values');
assert(/componentRefEndpoint\(issue\.componentRefNo, issue\.endpoint\)/.test(renderer), 'Workflow 4A must derive ComponentRefNo_Endpoint from ComponentRefNo and Endpoint');
assert(!/<th>Node<\/th><th>ComponentRefNo<\/th><th>DTXR<\/th>/.test(renderer), 'Workflow 4A must not keep the old ComponentRefNo-only header');
assert(/Build Weight Data/.test(renderer), 'Workflow 4A must expose Build Weight Data button');
assert(!/void compute\(\);/.test(renderer), 'Workflow 4A must not auto-compute merely when the tab is opened');
assert(/Ready to build/.test(renderer), 'Workflow 4A must start in explicit build-ready state');
assert(/resize:horizontal/.test(renderer), 'Workflow 4A table headers must be horizontally resizable');
assert(/enrichedOptionsForWeightMatch/.test(renderer), 'Workflow 4A must compute approximate weights using enriched/split XML options');
assert(/splitCondensedValveFlange/.test(renderer) && /split_condensed_valve_flange/.test(renderer), 'Workflow 4A must forward split-condensed flags before matching');
assert(/collectXmlCiiWeightMatchRows\(geometryXml/.test(renderer), 'Workflow 4A must collect weight rows from the post-enrichment geometry XML');
assert(/applyPreferredWeightsByDefault/.test(renderer), 'Workflow 4A must auto-apply preferred weights after Build Weight Data');
assert(/preferred-auto/.test(renderer), 'Workflow 4A auto-application must mark preferred auto-mapped weights');
assert(/isEndpoint2/.test(renderer) && /nodeName: useValveHint \? row\.nodeName : ''/.test(renderer), 'Workflow 4A Valve Hint must only apply to Endpoint 2 nodes');

assert(/Update Wall thickness based on DTXR/.test(preview), 'Preview must expose DTXR-based Wall thickness update button');
assert(/resolveXmlCiiWallThicknessFromDtxr/.test(preview), 'Preview must resolve Wall thickness from DTXR schedule and bore');
assert(/createPipeDataDb/.test(dtxrWall), 'DTXR wall resolver must use the existing pipe database first');
assert(/Sch|SCHEDULE|schedule/i.test(dtxrWall) && /ASME B36\.10/.test(dtxrWall), 'DTXR wall resolver must parse schedule and include B36.10 fallback table');

assert(/Build Weight Data/.test(nativePanels), 'Popup-native weight match must use Build Weight Data label');
assert(/data-master-state="loaded"/.test(nativePanels) && /data-master-state="empty"/.test(nativePanels), 'Popup-native Import Masters tabs must color loaded and empty states');
assert(!/data-native-run-option="allowFallbackHighNodeNumbers"/.test(nativePanels), '10000+ fallback run toggle must not be exposed in UI');
assert(!/data-native-config-bool="allowFallbackHighNodeNumbers"/.test(nativePanels), '10000+ fallback config toggle must not be exposed in UI');
assert(!/Disable gasket in output/.test(nativePanels), 'Popup-native UI must not expose a gasket toggle');
assert(/Gasket drop is default/.test(nativePanels) || /GASK nodes are dropped by default/.test(nativePanels), 'Popup-native UI must state gasket drop is default');

assert(/augmentWeightRowsWithNodeMeta/.test(bridge), 'Workflow bridge must augment popup weight rows with XML node metadata');
assert(/componentRefEndpoint/.test(bridge), 'Workflow bridge must provide componentRefEndpoint for post-run/native popup rows');
assert(/Endpoint/.test(bridge), 'Workflow bridge must read XML Endpoint values for post-run/native popup rows');
assert(!/const HIGH_FALLBACK_KEY/.test(bridge) && !/allow10000FallbackNodeNumbers/.test(bridge), 'Workflow bridge must not keep active 10000+ fallback aliases');
assert(/dropGasketNodes/.test(bridge) && /dropGasketsInEnrichment/.test(bridge), 'Workflow bridge must persist default gasket-drop aliases');

assert(/dropGasketNodes:\s*true/.test(config) && /dropGasketsInEnrichment:\s*true/.test(config), 'XML CII config defaults must drop gasket nodes by default');
assert(!/allowFallbackHighNodeNumbers:\s*false/.test(config) && !/allow10000FallbackNodeNumbers:\s*false/.test(config), 'XML CII config defaults must not expose 10000+ fallback options');
assert(/shouldDropGasketNodes/.test(stagedGeometry), 'Staged geometry authority must evaluate gasket drop option');
assert(/dropGasketNodesInDom/.test(stagedGeometry) && /removeChild/.test(stagedGeometry), 'Staged geometry authority must remove full GASK Node blocks');
assert(/gasketNodesDropped/.test(stagedGeometry), 'Staged geometry authority must report dropped gasket node count');
assert(!/gasketNodesSuppressed/.test(stagedGeometry), 'Staged geometry authority must not use old gasket suppression metric');
assert(/fallbackHighNodeNumbersSuppressed/.test(stagedGeometry), 'Staged geometry authority must report suppressed 10000+ fallback node count');
assert(!/allowFallbackHighNodeNumbers\(options/.test(stagedGeometry), 'Staged geometry authority must not use 10000+ fallback allow toggle');

assert(!/['"]PREV-NAME['"]/.test(sideloadConfig), 'DTXR_PS side-load basis must not include PREV-NAME');
assert(/PREV-NAME is intentionally excluded/.test(sideloadConfig), 'DTXR_PS side-load config must document PREV-NAME exclusion');
assert(/setItem\(key, 'regex'\)/.test(openRegex) && /LAUNCHER_SELECTOR/.test(openRegex), 'Workflow launcher must force popup open phase to Regex tab');

assert(/dropGasketNodesFromXmlText/.test(runParity), 'Enrichment parity must drop gaskets before base enrichment');
assert(/post-base-pre-parity/.test(runParity), 'Enrichment parity must drop gaskets before inline length and split renumbering');
assert(!/new Set\(\['FLAN', 'GASK'/.test(runParity), 'GASK must not be a renumberable negative inline type');
assert(/xmlCiiClassSizeKey/.test(branchResolver), 'Branch resolver must define piping-class+size smart key');
assert(/xmlCiiClassKey/.test(branchResolver), 'Branch resolver must define piping-class smart key');
assert(/wallThicknessKey/.test(branchResolver) && /corrosionKey/.test(branchResolver), 'Branch resolver must return Wall Thk and Corrosion smart edit keys');
assert(/smartClassSizeKey/.test(previewTable), 'Preview table must key Wall Thk by piping class + size');
assert(/smartClassKey/.test(previewTable), 'Preview table must key Corrosion/Material Code by piping class');
assert(/xmlCiiWorkflowSetConfigValue/.test(branchSample), 'Regex sample autoload must persist XML Branchname into workflow config');
assert(!/dispatchEvent/.test(branchSample), 'Regex sample autoload must not dispatch synthetic input/change churn');
assert(!/setTimeout\(/.test(branchSample), 'Regex sample autoload must not use delayed startup repair loops');
assert(/requestAnimationFrame/.test(branchSample), 'Regex sample autoload may refresh passively after Regex tab render');
assert(/data-modal-tab="regex"/.test(branchSample), 'Regex sample autoload must refresh when the Regex tab is opened');

console.log('XML CII weight match, DTXR wall thickness, gasket drop, regex sample, master-state colors, fallback-node policy, and smart propagation guards passed.');
