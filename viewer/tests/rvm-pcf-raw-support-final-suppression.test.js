import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge = fs.readFileSync('viewer/tabs/RvmRawSupportFinalSuppressionBridge.js', 'utf8');
const renderer = fs.readFileSync('viewer/tabs/viewer3d-rvm-tab-renderer.js', 'utf8');

assert.match(bridge, /__RVM_GEOMETRY_SUPPORT_SYMBOLS__/, 'removes generated support symbol root');
assert.match(bridge, /__RVM_SUPPORT_ASSEMBLY_MARKERS__/, 'removes support assembly marker root');
assert.match(bridge, /__RVM_EXPORTABLE_SUPPORT_GEOMETRY__/, 'removes generated support geometry root');
assert.match(bridge, /PE_\\d\+_\(PIPE\|BEND\|ELBOW\|VALVE\|FLANGE/, 'detects process RVM object names');
assert.match(bridge, /clearSupportFlags/, 'scrubs support flags from process objects');
assert.match(bridge, /mode === 'raw'/, 'only removes generated roots in raw support mode');
assert.match(renderer, /RvmRawSupportFinalSuppressionBridge\.js\?v=20260622-rvm-raw-support-final-suppression-1/, 'renderer loads final raw support suppression bridge');
assert.match(renderer, /installRvmRawSupportFinalSuppressionBridge\(\)/, 'renderer installs final raw support suppression bridge');
