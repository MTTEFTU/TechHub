const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
test('checkout country selector offers ISO values for Saudi Arabia, Bangladesh and United States without a fixed country', () => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/CheckoutCountrySelect.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, Intl, require: name => name === '@/backend/data/checkout-countries.json'
    ? require('../backend/data/checkout-countries.json') : require(name) });
  const html = renderToStaticMarkup(exports.CheckoutCountrySelect({ className: 'country' }));
  for (const [code, name] of [['SA', 'Saudi Arabia'], ['BD', 'Bangladesh'], ['US', 'United States']]) {
    assert.ok(html.includes(`value="${code}">${name}</option>`));
  }
  assert.ok(html.includes('name="countryCode"'));
  assert.ok(html.includes('required=""'));
  assert.match(html, /<option[^>]*value=""[^>]*selected=""/);
});
