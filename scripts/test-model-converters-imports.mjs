import assert from 'assert';
import { CONVERTERS } from '../viewer/tabs/model-converters/converter-registry.js';

try {
  assert(CONVERTERS, 'CONVERTERS should be exported');
  const ids = CONVERTERS.map(c => c.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 'All converter IDs must be unique');

  CONVERTERS.forEach(c => {
    assert(c.id, `Converter missing id`);
    assert(c.label, `Converter ${c.id} missing label`);
    assert(c.inputs, `Converter ${c.id} missing inputs`);
    assert(c.run, `Converter ${c.id} missing run function`);
  });

  assert(CONVERTERS.find(c => c.id === 'xml_to_cii'), 'Should contain xml_to_cii');
  assert(CONVERTERS.find(c => c.id === 'inputxml_to_cii2019'), 'Should contain inputxml_to_cii2019');

  console.log('Imports test passed');
} catch (e) {
  console.error('Imports test failed:', e);
  process.exit(1);
}
