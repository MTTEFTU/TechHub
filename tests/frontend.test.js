const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name),
    Buffer, process, fetch: global.fetch, AbortSignal, Request, URLSearchParams, Intl, console });
  return exports;
}
test('cart stores Shopify variant GIDs, separates variants and rejects legacy local products', () => {
  const { addCartItem, restoreCart } = load('lib/cart-state.ts');
  const p = { id: 'gid://shopify/Product/1', variantId: 'gid://shopify/ProductVariant/10', price: 20, availableForSale: true, stock: 10 };
  let items = addCartItem([], p);
  items = addCartItem(items, { ...p, variantId: 'gid://shopify/ProductVariant/11' });
  items = addCartItem(items, { ...p, price: 22 });
  assert.equal(items.length, 2); assert.equal(items[0].qty, 2); assert.equal(items[0].product.price, 22);
  assert.equal(addCartItem(items, { ...p, availableForSale: false }).length, 2);
  assert.equal(restoreCart(JSON.stringify([{ product: { id: 'mongo-id' }, qty: 1 }])).length, 0);
  assert.equal(restoreCart(JSON.stringify(items)).length, 2);
  assert.equal(restoreCart('bad json').length, 0);
  assert.equal(restoreCart(JSON.stringify([{ product: p, qty: 1.5 }])).length, 0);
});
test('Shopify variant selection uses correct price, compare-at price, availability and currency', () => {
  const { toProduct, money } = load('lib/products.ts');
  const p = { _id: 'gid://shopify/Product/1', handle: 'phone', title: 'Phone', description: 'Test', productType: 'Phones', images: [], variants: [
    { id: 'gid://shopify/ProductVariant/10', title: 'Black', availableForSale: false, quantityAvailable: 0,
      price: { amount: '10.00', currencyCode: 'BDT' }, selectedOptions: [{ name: 'Color', value: 'Black' }] },
    { id: 'gid://shopify/ProductVariant/11', title: 'White', availableForSale: true, quantityAvailable: null,
      price: { amount: '12.50', currencyCode: 'BDT' }, compareAtPrice: { amount: '15.00', currencyCode: 'BDT' },
      selectedOptions: [{ name: 'Color', value: 'White' }] },
  ] };
  const selected = toProduct(p);
  assert.equal(selected.variantId, p.variants[1].id); assert.equal(selected.price, 12.5);
  assert.equal(selected.compareAtPrice, 15); assert.equal(selected.currencyCode, 'BDT');
  assert.equal(toProduct(p,p.variants[0]).availableForSale, false);
  assert.ok(money(12.5,'BDT').includes('12.50'));
});
test('Next catalog cache shares a tag across listings and detail paths with bounded TTL', async () => {
  const originalFetch = global.fetch;
  let config, requested;
  global.fetch = async url => { requested = url; return { ok: true, json: async () => ({ products: [] }) }; };
  try {
    const module = load('lib/catalog-server.ts', {
      'server-only': {}, './api': { API_URL: 'https://backend.example/api' },
      'next/cache': { unstable_cache: (fn, keys, options) => { config = { keys, options }; return fn; } },
    });
    await module.catalogRequest('/products?sort=newest');
    assert.equal(requested, 'https://backend.example/api/products?sort=newest');
    assert.equal(config.options.revalidate, 60); assert.equal(config.options.tags[0], 'shopify-products');
    await module.catalogRequest('/products/phone');
    assert.equal(requested, 'https://backend.example/api/products/phone');
  } finally { global.fetch = originalFetch; }
});
test('Next revalidation endpoint authenticates server-only secret before invalidating shared tag', async () => {
  const original = process.env.SHOPIFY_REVALIDATION_SECRET;
  process.env.SHOPIFY_REVALIDATION_SECRET = 'unit-test-cache-secret';
  let invalidations = 0;
  const route = load('app/api/catalog/revalidate/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next/cache': { revalidateTag: tag => { assert.equal(tag,'shopify-products'); invalidations++; } },
    '@/lib/catalog-server': { CATALOG_TAG: 'shopify-products' },
  });
  try {
    for (const token of ['', 'forged', 'unit-test-cache-secrex']) {
      assert.equal((await route.POST(new Request('https://frontend.example', { method: 'POST', headers: { 'x-tech-hub-revalidation': token } }))).status, 401);
    }
    assert.equal(invalidations,0);
    assert.equal((await route.POST(new Request('https://frontend.example', { method: 'POST', headers: { 'x-tech-hub-revalidation': process.env.SHOPIFY_REVALIDATION_SECRET } }))).status,200);
    assert.equal(invalidations,1);
    delete process.env.SHOPIFY_REVALIDATION_SECRET;
    assert.equal((await route.POST(new Request('https://frontend.example', { method: 'POST' }))).status,503);
  } finally {
    if (original === undefined) delete process.env.SHOPIFY_REVALIDATION_SECRET;
    else process.env.SHOPIFY_REVALIDATION_SECRET = original;
  }
});
