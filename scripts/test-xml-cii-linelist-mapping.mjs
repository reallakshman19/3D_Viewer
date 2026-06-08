import assert from 'assert';
import { detectLineListFieldMap } from '../viewer/tabs/model-converters/converters/xml-to-cii2019/linelist-mapping.js';

try {
  const headers = [
    'Service',
    'Line number',
    'Piping Class',
    'Temp Max ºC',
    'Temp. ºC',
    'Temp Min ºC',
    'Test Pressure',
    'Insulation Thickness [mm]',
    'Mixed kg/m³',
    'Gas kg/m³',
    'Liquid kg/m³',
    'Fluid'
  ];

  // Create dummy rows to test header detection
  const rows = [
    headers.reduce((acc, h) => { acc[h] = ''; return acc; }, {})
  ];

  const map = detectLineListFieldMap(rows);

  assert.strictEqual(map.lineKey1, 'Service');
  assert.strictEqual(map.lineKey2, 'Line number');
  assert.strictEqual(map.pipingClass, 'Piping Class');
  assert.strictEqual(map.t1, 'Temp Max ºC');
  assert.strictEqual(map.t2, 'Temp. ºC');
  assert.strictEqual(map.t3, 'Temp Min ºC');
  assert.strictEqual(map.hydroPressure, 'Test Pressure');
  assert.strictEqual(map.insThk, 'Insulation Thickness [mm]');
  assert.strictEqual(map.densityMixed, 'Mixed kg/m³');
  assert.strictEqual(map.densityGas, 'Gas kg/m³');
  assert.strictEqual(map.densityLiquid, 'Liquid kg/m³');
  assert.strictEqual(map.phase, 'Fluid');

  console.log('Linelist mapping test passed');
} catch (e) {
  console.error('Linelist mapping test failed:', e);
  process.exit(1);
}
