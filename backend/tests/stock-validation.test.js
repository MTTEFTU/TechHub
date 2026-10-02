const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.SHOPIFY_STORE_DOMAIN = 'stock-test.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'stock-test-only-token';
const { validateLines } = require('../services/catalog');
const { stockRejectionReason } = require('../services/stockValidation');
const { variant, variantId } = require('./fixtures');
const items = [{ variantId, quantity: 2 }];

test('fresh country-aware stock validation and safe rejection diagnostics', async t => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const originalEnv = process.env.NODE_ENV;
  let current = variant(), requests = 0;
  const logs = [];
  global.fetch = async (_url, options) => {
    requests++;
    assert.equal(options.cache, 'no-store');
    const { query, variables } = JSON.parse(options.body);
    assert.equal(variables.countryCode, 'SA');
    assert.match(query, /\$countryCode: CountryCode!/);
    assert.match(query, /@inContext\(country: \$countryCode\)/);
    assert.deepEqual(variables.ids, [variantId]);
    return { ok: true, json: async () => ({ data: { nodes: [current] } }) };
  };
  console.warn = (...args) => logs.push(args.join(' '));
  process.env.NODE_ENV = 'development';
  try {
    await t.test('quantityAvailable 10 with quantity 2 is allowed in SA', async () => {
      current = variant({ quantityAvailable: 10 });
      const [line] = await validateLines(items, 'SA');
      assert.equal(line.quantity, 2);
      assert.equal(line.stock, 10);
      assert.equal(logs.length, 0);
    });
    await t.test('fresh inventory 1 with quantity 2 rejects and identifies the precise branch', async () => {
      current = variant({ quantityAvailable: 1 });
      await assert.rejects(validateLines(items, 'SA', 'checkout'), { status: 409, message: 'Shopify reports insufficient sellable stock for the requested quantity.' });
      const log = logs.at(-1);
      assert.ok(log.startsWith('[Shopify stock validation]'));
      const entry = JSON.parse(log.slice(log.indexOf('{')));
      assert.equal(entry.reason, 'insufficient_sellable_quantity');
      assert.equal(entry.source, 'checkout');
      assert.equal(entry.variantId, variantId);
      assert.equal(entry.requestedQuantity, 2);
      assert.equal(entry.countryCode, 'SA');
      assert.equal(entry.availableForSale, true);
      assert.equal(entry.quantityAvailable, 1);
      assert.equal(entry.currentlyNotInStock, false);
      assert.equal(entry.inventoryTracked, null);
      assert.equal(entry.inventoryPolicy, null);
      assert.deepEqual(entry.userErrors, []);
      assert.deepEqual(entry.warnings, []);
      assert.equal(entry.cartCreated, false);
    });
    await t.test('null quantity plus availableForSale true is allowed without coercing to zero', async () => {
      current = variant({ quantityAvailable: null });
      assert.equal((await validateLines(items, 'SA'))[0].stock, null);
    });
    await t.test('availableForSale false rejects even when inventory is 10', async () => {
      current = variant({ quantityAvailable: 10, availableForSale: false });
      await assert.rejects(validateLines(items, 'SA', 'quote'), { status: 409, message: 'A selected variant is unavailable in the selected shipping country.' });
      assert.match(logs.at(-1), /variant_unavailable_in_context/);
      assert.match(logs.at(-1), /"source":"quote"/);
    });
    await t.test('Shopify explicit backorder availability is preserved but unavailable variants cannot backorder', async () => {
      current = variant({ quantityAvailable: 0, currentlyNotInStock: true });
      assert.equal((await validateLines(items, 'SA'))[0].stock, null);
      current = variant({ quantityAvailable: 0, currentlyNotInStock: true, availableForSale: false });
      await assert.rejects(validateLines(items, 'SA'), { status: 409 });
    });
    await t.test('invalid country fails before fetching Shopify', async () => {
      const before = requests;
      for (const country of ['XX', 'ZZ', 'SAU', 'sa', '', null, { code: 'SA' }]) {
        await assert.rejects(validateLines(items, country), { status: 400 });
      }
      assert.equal(requests, before);
    });
    await t.test('diagnostics never include arbitrary payload/customer fields and remain off in production', async () => {
      current = variant({ quantityAvailable: 1, title: 'Private Name', email: 'private@example.com',
        address: 'Private Street', token: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN });
      await assert.rejects(validateLines(items, 'SA'), { status: 409 });
      for (const privateValue of ['Private Name', 'private@example.com', 'Private Street', process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN]) {
        assert.ok(!logs.at(-1).includes(privateValue));
      }
      const before = logs.length;
      process.env.NODE_ENV = 'production';
      await assert.rejects(validateLines(items, 'SA'), { status: 409 });
      assert.equal(logs.length, before);
    });
    assert.ok(requests >= 8, 'each validation fetched fresh Shopify data');
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv;
  }
});

test('stock diagnostic reasons distinguish missing variants, wrong GIDs and product availability', () => {
  assert.equal(stockRejectionReason(null, variantId, 2), 'variant_not_returned');
  assert.equal(stockRejectionReason(variant({ id: 'gid://shopify/ProductVariant/999' }), variantId, 2), 'variant_id_mismatch');
  assert.equal(stockRejectionReason(variant({ product: { availableForSale: false } }), variantId, 2), 'product_unavailable_in_context');
});

test('a fresh SA quote recovers from a BD market rejection without reusing country availability', async () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.NODE_ENV;
  const requestedCountries = [];
  process.env.NODE_ENV = 'test';
  global.fetch = async (_url, options) => {
    const { variables, query } = JSON.parse(options.body);
    requestedCountries.push(variables.countryCode);
    assert.match(query, /@inContext\(country: \$countryCode\)/);
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ data: { nodes: [
      variables.countryCode === 'BD'
        ? variant({ availableForSale: false, quantityAvailable: 0, product: { availableForSale: false } })
        : variant({ availableForSale: true, quantityAvailable: 9 }),
    ] } }) };
  };
  try {
    await assert.rejects(validateLines(items, 'BD', 'quote'), {
      status: 409, message: 'A selected product is unavailable in the selected shipping country.',
    });
    assert.equal((await validateLines(items, 'SA', 'quote'))[0].stock, 9);
    assert.equal((await validateLines(items, 'SA', 'checkout'))[0].quantity, 2);
    assert.deepEqual(requestedCountries, ['BD', 'SA', 'SA']);
  } finally {
    global.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv;
  }
});
