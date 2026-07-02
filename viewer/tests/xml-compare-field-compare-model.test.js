import assert from 'node:assert/strict';

import { addCompareField, availableCompareFields, createXmlCompareFieldCompareModel, normalizeCompareFields, removeCompareField } from '../xml-compare/XmlCompareFieldCompareModel.js';

assert.deepEqual(normalizeCompareFields(['globalX','globalY','globalX','uid','raw','']),['globalX','globalY']);
assert.deepEqual(addCompareField(['globalX'],'globalY'),['globalX','globalY']);
assert.deepEqual(addCompareField(['globalX'],'globalX'),['globalX']);
assert.deepEqual(removeCompareField(['globalX','globalY','globalZ'],'globalY'),['globalX','globalZ']);
assert.deepEqual(availableCompareFields(['uid','globalX','globalY','position','compactFields','MaterialName']),['globalX','globalY','MaterialName']);

const model=createXmlCompareFieldCompareModel({
  sourceRecord:{globalX:'23227.580',globalY:'3257.150',globalZ:'-22942.292',MaterialName:'A106   B',Blank:'',BadNumber:'-nan'},
  targetRecord:{globalX:'23227.590',globalY:'3257.150',globalZ:'-22940.292',MaterialName:'a106 b',Blank:'',BadNumber:'-nan'},
  compareFields:['globalX','globalY','globalZ','MaterialName','Blank','BadNumber','MissingField']
});
assert.equal(model.schema,'xml-compare-field-compare-model/v1');
const globalX=model.rows.find((row)=>row.field==='globalX');
assert.equal(globalX.valueType,'number');
assert.equal(Number(globalX.delta.toFixed(3)),0.01);
assert.equal(Number(globalX.absDelta.toFixed(3)),0.01);
assert.equal(globalX.status,'changed');
const globalY=model.rows.find((row)=>row.field==='globalY');
assert.equal(globalY.status,'unchanged');
const material=model.rows.find((row)=>row.field==='MaterialName');
assert.equal(material.valueType,'string');
assert.equal(material.status,'unchanged');
const blank=model.rows.find((row)=>row.field==='Blank');
assert.equal(blank.valueType,'blank');
assert.equal(blank.status,'blank');
const bad=model.rows.find((row)=>row.field==='BadNumber');
assert.equal(bad.valueType,'string');
assert.equal(bad.status,'unchanged');
assert.ok(model.diagnostics.some((item)=>item.code==='missing_source_field'&&item.field==='MissingField'));
assert.ok(model.diagnostics.some((item)=>item.code==='missing_target_field'&&item.field==='MissingField'));
assert.equal(model.summary.fieldCount,7);
assert.equal(model.summary.numericCount,3);
assert.equal(model.summary.stringCount,2);
assert.equal(model.summary.changedCount,2);
console.log('xml-compare-field-compare-model: all assertions passed');
