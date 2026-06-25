#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const renderer = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js');
const nativePanels = read('viewer/tabs/model-converters/xml-cii-popup-native-panels.js');
const bridge = read('viewer/tabs/model-converters/xml-cii-workflow-bridge.js');

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

assert(/ComponentRefNo_Endpoint/.test(nativePanels), 'Popup-native approximate weight match table must show ComponentRefNo_Endpoint');
assert(/ComponentType/.test(nativePanels), 'Popup-native approximate weight match table must show ComponentType');
assert(/componentRefEndpoint/.test(nativePanels), 'Popup-native approximate weight match table must consume componentRefEndpoint rows');

assert(/augmentWeightRowsWithNodeMeta/.test(bridge), 'Workflow bridge must augment popup weight rows with XML node metadata');
assert(/componentRefEndpoint/.test(bridge), 'Workflow bridge must provide componentRefEndpoint for post-run/native popup rows');
assert(/Endpoint/.test(bridge), 'Workflow bridge must read XML Endpoint values for post-run/native popup rows');

console.log('XML CII weight match ComponentRefNo_Endpoint and ComponentType column guard passed.');
