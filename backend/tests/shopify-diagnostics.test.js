const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.SHOPIFY_STORE_DOMAIN = 'diagnostic-test.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'test-only-storefront-credential';
const { createCart } = require('../services/shopify');

test('Storefront diagnostics are redacted and development-only with safe errors', async (t) => {
  const previousFetch = global.fetch;
  const previousError = console.error;
  const previousEnv = process.env.NODE_ENV;
  const logs = [];
  console.error = (...args) => logs.push(args.join(' '));
  const input = { lines: [{ merchandiseId: 'gid://shopify/ProductVariant/123', quantity: 1 }], email: 'buyer@example.com', checkoutId: 'test-checkout' };
  const response = (status, body) => ({
    status, ok: status === 200, headers: { get: () => '2026-07' }, json: async () => body,
  });
  try {
    process.env.NODE_ENV = 'development';
    await t.test('HTTP errors show status and scrub credentials', async () => {
      global.fetch = async () => response(403, { errors: [{
        message: 'Access denied ' + process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN + ' shpat_fake_secret buyer@example.com',
        extensions: { code: 'ACCESS_DENIED', secret: 'never-serialize-this-extension' },
      }] });
      await assert.rejects(createCart(input), { status: 502, message: 'Shopify Checkout could not be created. Please try again.' });
      assert.match(logs[0], /"status":403/);
      assert.match(logs[0], /ACCESS_DENIED/);
      for (const secret of [process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN, 'shpat_fake_secret', 'buyer@example.com', 'never-serialize-this-extension']) {
        assert.ok(!logs[0].includes(secret));
      }
    });
    await t.test('HTTP 200 GraphQL errors remain safe', async () => {
      global.fetch = async () => response(200, { errors: [{ message: 'Invalid query', extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }] });
      await assert.rejects(createCart(input), { status: 502 });
      assert.match(logs.at(-1), /"reason":"graphql_errors"/);
      assert.match(logs.at(-1), /"status":200/);
    });
    await t.test('cart userErrors and warnings are visible and availability response is preserved', async () => {
      global.fetch = async () => response(200, { data: { cartCreate: {
        cart: null, userErrors: [{ field: ['input', 'lines'], message: 'Merchandise unavailable' }],
        warnings: [{ message: 'Inventory warning' }],
      } } });
      await assert.rejects(createCart(input), { status: 409, message: 'A selected product is unavailable on Shopify.' });
      assert.match(logs.at(-1), /Merchandise unavailable/);
      assert.match(logs.at(-1), /Inventory warning/);
      assert.match(logs.at(-1), /"status":200/);
    });
    await t.test('invalid JSON and missing payload are diagnosed safely', async () => {
      global.fetch = async () => ({ ...response(200, null), json: async () => { throw new Error('bad JSON'); } });
      await assert.rejects(createCart(input), { status: 502 });
      assert.match(logs.at(-1), /invalid_json/);
      global.fetch = async () => response(200, { data: {} });
      await assert.rejects(createCart(input), { status: 502, message: 'Shopify Checkout could not be created.' });
      assert.match(logs.at(-1), /cart_create_failed/);
    });
    await t.test('network failures never serialize thrown exceptions', async () => {
      global.fetch = async () => { throw new Error('network ' + process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN); };
      await assert.rejects(createCart(input), { status: 502 });
      assert.match(logs.at(-1), /network_failure/);
      assert.ok(!logs.at(-1).includes(process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN));
    });
    await t.test('production emits no Storefront diagnostics', async () => {
      process.env.NODE_ENV = 'production';
      const count = logs.length;
      global.fetch = async () => response(401, { errors: [{ message: 'Internal error' }] });
      await assert.rejects(createCart(input), { status: 502, message: 'Shopify Checkout could not be created. Please try again.' });
      assert.equal(logs.length, count);
    });
    await t.test('successful carts retain behavior without logging', async () => {
      process.env.NODE_ENV = 'development';
      const count = logs.length;
      const cart = { id: 'test', checkoutUrl: 'https://diagnostic-test.myshopify.com/checkouts/test' };
      global.fetch = async () => response(200, { data: { cartCreate: { cart, userErrors: [], warnings: [] } } });
      assert.deepEqual(await createCart(input), cart);
      assert.equal(logs.length, count);
    });
  } finally {
    global.fetch = previousFetch;
    console.error = previousError;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});
