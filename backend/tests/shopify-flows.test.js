const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
// Set dummy configuration BEFORE loading the server; dotenv will not overwrite it.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.SHOPIFY_WEBHOOK_SECRET = 'test-only-webhook-secret';
process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'test-only-storefront-token';
const app = require('../server');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Checkout = require('../models/ShopifyCheckout');
const User = require('../models/User');
const { API_VERSION } = require('../services/shopify');
const userId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const address = { fullName: 'Test Buyer', phone: '0123456789', email: 'test@example.com', address: 'Test street', city: 'Test city', postalCode: '1234' };

test('checkout flows and verified Shopify webhook lifecycle through exported Vercel app', async (t) => {
  assert.equal(require('../api/index'), app);
  const server = app.listen(0);
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const realFetch = global.fetch;
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
  const product = { id: productId, name: 'Test product', images: [], stock: 10, price: 20, shopifyVariantId: 'gid://shopify/ProductVariant/123' };
  let checkout;
  let shopifyOrder;
  let orderCreates = 0;
  let stockDecrements = 0;
  const restores = [];
  function stub(object, key, value) {
    const previous = object[key];
    object[key] = value;
    restores.push(() => { object[key] = previous; });
  }
  stub(User, 'findById', async () => ({ id: userId, role: 'user' }));
  stub(Product, 'find', async () => [product]);
  stub(Product, 'findOneAndUpdate', async () => product);
  stub(Product, 'updateOne', async (_query, update) => { if (update.$inc?.stock < 0) stockDecrements++; });
  stub(Checkout.prototype, 'save', async function () { checkout = this; return this; });
  stub(Checkout, 'findById', async (id) => checkout && checkout.id === id ? checkout : null);
  stub(Checkout, 'findOne', async (query) => {
    if (query.order) return shopifyOrder && String(query.order) === shopifyOrder.id ? checkout : null;
    return checkout && String(query._id) === checkout.id && query.user === userId ? checkout : null;
  });
  stub(Order, 'create', async (data) => {
    orderCreates++;
    const order = new Order(data);
    if (data.paymentMethod === 'shopify') shopifyOrder = order;
    return order;
  });
  stub(Order, 'findOne', async (query) => {
    const ids = query.shopifyOrderId?.$in || [query.shopifyOrderId];
    return shopifyOrder && ids.includes(shopifyOrder.shopifyOrderId) ? shopifyOrder : null;
  });
  stub(Order, 'updateOne', async (_query, update) => { Object.assign(shopifyOrder, update.$set); });
  stub(global, 'fetch', async (url, options) => {
    if (String(url).startsWith(base)) return realFetch(url, options);
    assert.equal(url, 'https://test-shop.myshopify.com/api/' + API_VERSION + '/graphql.json');
    assert.equal(options.headers['X-Shopify-Storefront-Access-Token'], 'test-only-storefront-token');
    assert.equal(options.headers['X-Shopify-Access-Token'], undefined);
    const input = JSON.parse(options.body).variables.input;
    assert.deepEqual(input.lines, [{ merchandiseId: product.shopifyVariantId, quantity: 2 }]);
    assert.equal(input.buyerIdentity.email, address.email);
    assert.equal(input.attributes[0].key, 'tech_hub_checkout_id');
    assert.match(input.attributes[0].value, /^[a-f0-9]{24}$/);
    return { ok: true, json: async () => ({ data: { cartCreate: {
      cart: { id: 'gid://shopify/Cart/test', checkoutUrl: 'https://test-shop.myshopify.com/checkouts/test' }, userErrors: [],
    } } }) };
  });
  async function request(path, body) {
    return fetch(base + path, { method: 'POST', headers: {
      'content-type': 'application/json', authorization: 'Bearer ' + token,
    }, body: JSON.stringify(body) });
  }
  async function deliver(topic, id, raw, overrides = {}) {
    const signature = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET).update(raw).digest('base64');
    return fetch(base + '/api/shopify/webhooks', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-shopify-hmac-sha256': signature,
      'x-shopify-topic': topic, 'x-shopify-webhook-id': id,
      'x-shopify-shop-domain': 'test-shop.myshopify.com', ...overrides,
    }, body: raw });
  }
  try {
    await t.test('COD checkout calculates server-side totals and remains pending', async () => {
      const response = await request('/api/orders', { items: [{ productId, quantity: 2 }], shippingAddress: address, totalAmount: 1, paymentStatus: 'paid' });
      assert.equal(response.status, 201);
      const { order } = await response.json();
      assert.equal(order.totalAmount, 49);
      assert.equal(order.paymentMethod, 'cash_on_delivery');
      assert.equal(order.paymentStatus, 'pending');
      assert.equal(shopifyOrder, undefined);
    });
    await t.test('Shopify Checkout creates a mapped Storefront cart without marking paid', async () => {
      const response = await request('/api/shopify/checkout', { items: [{ productId, quantity: 2 }], shippingAddress: address });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).checkoutId, checkout.id);
      assert.equal(checkout.status, 'pending');
      assert.equal(shopifyOrder, undefined);
      const status = await fetch(base + '/api/shopify/checkout/' + checkout.id + '/status', { headers: { authorization: 'Bearer ' + token } });
      assert.equal(status.status, 200);
      assert.equal((await status.json()).checkout.status, 'pending');
    });
    const paid = JSON.stringify({
      id: 42, admin_graphql_api_id: 'gid://shopify/Order/42', name: '#TEST42',
      financial_status: 'paid', total_price: '40.00', email: address.email,
      note_attributes: [{ name: 'tech_hub_checkout_id', value: checkout.id }],
      line_items: [{ variant_id: 123, name: product.name, price: '20.00' }],
    }, null, 2) + '\n';
    await t.test('invalid HMAC, altered bytes, and wrong shop cannot mark paid', async () => {
      assert.equal((await deliver('orders/paid', 'bad', paid, { 'x-shopify-hmac-sha256': 'forged' })).status, 401);
      const compactSignature = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET).update(JSON.stringify(JSON.parse(paid))).digest('base64');
      assert.equal((await deliver('orders/paid', 'altered', paid, { 'x-shopify-hmac-sha256': compactSignature })).status, 401);
      assert.equal((await deliver('orders/paid', 'wrong-shop', paid, { 'x-shopify-shop-domain': 'other.myshopify.com' })).status, 401);
      assert.equal(checkout.status, 'pending');
      assert.equal(shopifyOrder, undefined);
    });
    await t.test('orders/paid verifies exact formatted bytes and creates the paid order', async () => {
      assert.equal((await deliver('orders/paid', 'paid-1', paid)).status, 200);
      assert.equal(shopifyOrder.paymentStatus, 'paid');
      assert.equal(shopifyOrder.totalAmount, 40);
      assert.equal(checkout.status, 'paid');
      assert.equal(String(checkout.order), shopifyOrder.id);
      assert.equal(stockDecrements, 1);
      assert.equal(orderCreates, 2); // One COD, one Shopify.
    });
    await t.test('duplicate delivery and sequential paid replay do not duplicate order or stock', async () => {
      const duplicate = await deliver('orders/paid', 'paid-1', paid);
      assert.equal(duplicate.status, 200);
      assert.equal(await duplicate.text(), 'Already processed');
      assert.equal((await deliver('orders/paid', 'paid-2', paid)).status, 200);
      assert.equal(stockDecrements, 1);
      assert.equal(orderCreates, 2);
    });
    await t.test('refunds/create locates the mapped order and duplicate refund is acknowledged', async () => {
      const refund = JSON.stringify({ id: 99, order_id: 42 });
      assert.equal((await deliver('refunds/create', 'refund-1', refund)).status, 200);
      assert.equal(shopifyOrder.paymentStatus, 'refunded');
      assert.equal(shopifyOrder.shopifyFinancialStatus, 'refunded');
      assert.equal(await (await deliver('refunds/create', 'refund-1', refund)).text(), 'Already processed');
      assert.equal(stockDecrements, 1);
    });
    await t.test('unmapped test deliveries are ignored', async () => {
      assert.equal(await (await deliver('orders/paid', 'unmapped', '{"id":999}')).text(), 'Ignored');
      assert.equal(orderCreates, 2);
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
    server.close();
    await once(server, 'close');
  }
});
