const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function mount(description) {
  let expanded = false;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('components/ProductDescription.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'react'
    ? { ...React, useId: () => 'description-test', useState: () => [expanded, update => { expanded = update(expanded); }] }
    : require(name) });
  return () => exports.ProductDescription({ description });
}

test('long descriptions start as a preview and toggle full text and paragraph whitespace', () => {
  const description = 'First paragraph.\n\n' + 'Shopify product details '.repeat(50);
  const render = mount(description);
  let element = render();
  let html = renderToStaticMarkup(element);
  assert.ok(html.includes('Read more'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes('aria-controls="description-test"'));
  assert.ok(html.includes('whitespace-pre-wrap'));
  assert.ok(html.includes('First paragraph.\n\n'));
  assert.ok(!html.includes(description));
  element.props.children[1].props.onClick();
  element = render();
  html = renderToStaticMarkup(element);
  assert.ok(html.includes(description));
  assert.ok(html.includes('Show less'));
  assert.ok(html.includes('aria-expanded="true"'));
  element.props.children[1].props.onClick();
  assert.ok(renderToStaticMarkup(render()).includes('Read more'));
});

test('short and empty descriptions need no expansion control and text is escaped', () => {
  for (const description of ['Short description.', 'x'.repeat(500), '<script>unsafe</script>']) {
    const html = renderToStaticMarkup(mount(description)());
    assert.ok(!html.includes('<button'));
    assert.ok(!html.includes('<script>'));
  }
  assert.equal(renderToStaticMarkup(mount(' \n ')()), '');
});
