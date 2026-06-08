import assert from 'assert';
import { computeElementLengthFromCiiVector } from '../viewer/tabs/model-converters/converters/xml-to-cii2019/element-length.js';

try {
  const dx = 109.000;
  const dy = -0.550;
  const dz = 0.000;

  const length = computeElementLengthFromCiiVector(dx, dy, dz);
  assert(Math.abs(length - 109.001) < 0.01, `Length ${length} is not approx 109.001`);

  console.log('Element length test passed');
} catch (e) {
  console.error('Element length test failed:', e);
  process.exit(1);
}
