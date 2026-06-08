import assert from 'assert';
import { deriveLineKeyFromBranchName } from '../viewer/tabs/model-converters/converters/xml-to-cii2019/regex-line-key.js';

try {
  const line1 = deriveLineKeyFromBranchName('/ASIM-1885-10"-S8810101-91261M7-HC/B1', { lineKeyTokenPositions: [4] });
  assert.strictEqual(line1, 'S8810101');

  const line2 = deriveLineKeyFromBranchName('/ASIM-1885-2"-D8810386-91261M7-PP/B1', { lineKeyTokenPositions: [4] });
  assert.strictEqual(line2, 'D8810386');

  console.log('Regex line key test passed');
} catch (e) {
  console.error('Regex line key test failed:', e);
  process.exit(1);
}
