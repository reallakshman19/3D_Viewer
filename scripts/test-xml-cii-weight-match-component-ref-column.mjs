#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const renderer = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js');
const nativePanels = read('viewer/tabs/model-converters/xml-cii-popup-native-panels.js');
const bridge = read('viewer/tabs/model-converters/xml-cii-workflow-bridge.js');
const stagedGeometry = read('viewer/converters/xml-cii2019-core/staged-geometry-authority.js');
const config = read('viewer/converters/xml-cii2019-core/config.js');
const modelConvertersTab = read('viewer/tabs/model-converters/ModelConvertersTab.js');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL: ' + message);
    process.exit(1);
  }
}

assert(/<th>ComponentType<\/th>/.test(renderer), 'Workflow 4A table header must show ComponentType');
assert(/<th>Node<\/th><th>ComponentRefNo_Endpoint<\/th><th>DTXR<\/th>/.test(renderer), 'Workflow 4A table header must show ComponentRefNo_Endpoint between Node and DTXR');
assert(/componentRefEndpoint/.test(renderer), 'Workflow 4A row renderer must output componentRefEndpoint');
assert(/Endpoint/.test(renderer), 'Workflow 4A renderer must read XML Endpoint values');
assert(/componentRefEndpoint\(issue\.componentRefNo, issue\.endpoint\)/.test(renderer), 'Workflow 4A must derive ComponentRefNo_Endpoint from ComponentRefNo and Endpoint');
assert(!/<th>Node<\/th><th>ComponentRefNo<\/th><th>DTXR<\/th>/.test(renderer), 'Workflow 4A must not keep the old ComponentRefNo-only header');

assert(/enrichedOptionsForWeightMatch/.test(renderer), 'Workflow 4A must compute approximate weights using enriched/split XML options');
assert(/splitCondensedValveFlange/.test(renderer) && /split_condensed_valve_flange/.test(renderer), 'Workflow 4A must forward split-condensed flags before matching');
assert(/collectXmlCiiWeightMatchRows\(geometryXml/.test(renderer), 'Workflow 4A must collect weight rows from the post-enrichment geometry XML');
assert(/applyPreferredWeightsByDefault/.test(renderer), 'Workflow 4A must auto-apply preferred weights before showing the review popup');
assert(/preferred-auto/.test(renderer), 'Workflow 4A auto-application must mark preferred auto-mapped weights');

assert(/ComponentRefNo_Endpoint/.test(nativePanels), 'Popup-native approximate weight match table must show ComponentRefNo_Endpoint');
assert(/ComponentType/.test(nativePanels), 'Popup-native approximate weight match table must show ComponentType');
assert(/componentRefEndpoint/.test(nativePanels), 'Popup-native approximate weight match table must consume componentRefEndpoint rows');

assert(/augmentWeightRowsWithNodeMeta/.test(bridge), 'Workflow bridge must augment popup weight rows with XML node metadata');
assert(/componentRefEndpoint/.test(bridge), 'Workflow bridge must provide componentRefEndpoint for post-run/native popup rows');
assert(/Endpoint/.test(bridge), 'Workflow bridge must read XML Endpoint values for post-run/native popup rows');
assert(/disableGasketNodes/.test(bridge) && /disableGasketInOutput/.test(bridge), 'Workflow bridge must persist gasket suppression config aliases');

assert(/disableGasketNodes/.test(config) && /disableGasketInOutput/.test(config), 'XML CII config defaults must expose gasket suppression option and alias');
assert(/shouldSuppressGasketNodes/.test(stagedGeometry), 'Staged geometry authority must evaluate gasket suppression option');
assert(/gasketNodesSuppressed/.test(stagedGeometry), 'Staged geometry authority must report suppressed gasket node count');
assert(/<NodeNumber>-1<\/NodeNumber>/.test(stagedGeometry), 'Gasket suppression must renumber GASK nodes to -1');

assert(/data-native-config-bool="disableGasketNodes"/.test(nativePanels), 'Native Config panel must expose disableGasketNodes as a source-owned config checkbox');
assert(/data-native-run-option="disableGasketNodes"/.test(nativePanels), 'Native Run panel must expose disableGasketNodes as a source-owned run option');
assert(/Disable gasket in output \(set GASK NodeNumber to -1\)/.test(nativePanels), 'Native workflow UI must display the gasket suppression engineering label');
assert(/disableGasketNodes and disableGasketInOutput/.test(nativePanels), 'Native workflow UI must document gasket alias persistence');
assert(/GASK nodes (?:stay|are retained) in enriched XML/.test(nativePanels), 'Native workflow UI must document that gasket nodes are retained');
assert(!/xml-cii-workflow-hotfix\.js/.test(modelConvertersTab), 'ModelConvertersTab must not reintroduce the old XML CII workflow hotfix module as UI owner');

console.log('XML CII weight match ComponentRefNo_Endpoint, post-split matching, and native disable-option UI guards passed.');
