import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const tabJs = fs.readFileSync(path.join(root, 'tabs/viewer3d-rvm-tab.js'), 'utf8');

assert.match(
  tabJs,
  /accept="[^"]*\.rvm[^"]*\.rev[^"]*\.json[^"]*\.uxml/,
  '3D RVM Viewer Load control must accept raw .rvm/.rev plus JSON/UXML files'
);

assert.ok(
  tabJs.includes("fileExtension(file?.name)") && tabJs.includes("if (ext === '.rvm')"),
  'RVM tab must route .rvm files before JSON/UXML text parsing'
);

assert.ok(
  tabJs.includes('loadRvmSource') && tabJs.includes('RvmHelperBridge') && tabJs.includes("rawRvmImport: true"),
  'Raw .rvm load path must use the assisted RVM load pipeline instead of JSON.parse'
);

assert.ok(
  tabJs.includes('convertRevFileToAvevaHierarchy') && tabJs.includes("if (ext === '.rev')"),
  'Raw .rev fallback must remain available for converted REV files'
);

assert.ok(
  tabJs.includes('viewer.setModel(payload.gltf.scene'),
  'Raw RVM loader must commit the converted GLB scene into the active RvmViewer3D instance'
);

console.log('RVM raw file import contract passed');
