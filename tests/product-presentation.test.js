const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/product-presentation.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
test('availability labels follow sale availability without misleading zero inventory', () => {
  const { availabilityLabel } = exportsObject;
  for (const stock of [undefined, null, 0, -1, NaN, Infinity, 1.5]) {
    assert.equal(availabilityLabel({ availableForSale: true, stock }), 'Available');
  }
  assert.equal(availabilityLabel({ availableForSale: true, stock: 7 }), '7 available');
  assert.equal(availabilityLabel({ availableForSale: false, stock: 7 }), 'Out of stock');
  assert.equal(availabilityLabel({ availableForSale: false, stock: 0 }), 'Out of stock');
});
