#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const file = path.join(repoRoot, 'viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js');
const source = fs.readFileSync(file, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL: ' + message);
    process.exit(1);
  }
}

assert(/<th>Node<\/th><th>ComponentRefNo<\/th><th>DTXR<\/th>/.test(source), 'Weight Match table header must show ComponentRefNo between Node and DTXR');
assert(/issue\.componentRefNo/.test(source), 'Weight Match row renderer must output issue.componentRefNo');
assert(/title="\$\{attr\(issue\.componentRefNo \|\| ''\)\}"/.test(source), 'ComponentRefNo cell must include a title for long references');
assert(/componentRefNo:\s*row\.componentRefNo|componentRefNo,/.test(source), 'ComponentRefNo must remain part of ranking and row data flow');

console.log('XML CII weight match ComponentRefNo column guard passed.');
