const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret';
process.env.SHOPIFY_WEBHOOK_SECRET = 'test-only-webhook-secret';
process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'test-only-storefront-token';
process.env.SHOPIFY_CLIENT_ID = 'flow-test-client-id';
process.env.SHOPIFY_CLIENT_SECRET = 'flow-test-client-secret';
process.env.SHOPIFY_REVALIDATION_URL = 'https://frontend.example/api/catalog/revalidate';
process.env.SHOPIFY_REVALIDATION_SECRET = 'test-only-revalidation';
const app = require('../server');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Checkout = require('../models/ShopifyCheckout');
const User = require('../models/User');
const { variant, product, variantId, productId } = require('./fixtures');
const userId = '507f1f77bcf86cd799439011';
const address = { fullName: 'Test Buyer', phone: '0123456789', email: 'test@example.com', address: 'Test street', city: 'Test city', postalCode: '1234', countryCode: 'BD' };
test('COD, Storefront Checkout, product webhooks and paid/refund lifecycle through Vercel app', async (t) => {
  assert.equal(require('../api/index'), app);
  const server = app.listen(0); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const realFetch = global.fetch;
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
  let checkout, shopifyOrder, codOrder;
  let expectedCountry = 'BD', onlineFetches = 0;
  let creates = 0, invalidations = 0, unavailable = false, invalidateFails = false, codFails = false;
  const restores = [];
  function stub(object, key, value) { const previous = object[key]; object[key] = value; restores.push(() => { object[key] = previous; }); }
  stub(User, 'findById', async () => ({ id: userId, role: 'user' }));
  for (const method of ['find','findOneAndUpdate','updateOne','exists']) stub(Product, method, () => { throw Error('MongoDB catalog must never be accessed'); });
  stub(Checkout.prototype, 'save', async function () { checkout = this; return this; });
  stub(Checkout, 'findById', async id => checkout?.id === id ? checkout : null);
  stub(Checkout, 'findOne', async query => query.order ? (shopifyOrder && String(query.order) === shopifyOrder.id ? checkout : null)
    : (checkout && String(query._id) === checkout.id && query.user === userId ? checkout : null));
  stub(Order.prototype, 'save', async function () { codOrder = this; return this; });
  stub(Order, 'findById', async () => codOrder);
  stub(Order, 'findOneAndUpdate', async (query, update) => {
    if (codOrder?.id === String(query._id) && codOrder.creationStatus === query.creationStatus) { codOrder.set(update.$set); return codOrder; }
    return null;
  });
  stub(Order, 'create', async data => { creates++; shopifyOrder = new Order(data); return shopifyOrder; });
  stub(Order, 'findOne', async query => {
    if (query.idempotencyKey) return codOrder?.idempotencyKey === query.idempotencyKey ? codOrder : null;
    const ids = query.shopifyOrderId?.$in || [query.shopifyOrderId];
    return shopifyOrder && ids.includes(shopifyOrder.shopifyOrderId) ? shopifyOrder : null;
  });
  stub(Order, 'updateOne', async (_query, update) => { Object.assign(shopifyOrder, update.$set); });
  stub(global, 'fetch', async (url, options) => {
    if (String(url).startsWith(base)) return realFetch(url, options);
    if (url === process.env.SHOPIFY_REVALIDATION_URL) {
      invalidations++;
      assert.equal(options.headers['X-Tech-Hub-Revalidation'], process.env.SHOPIFY_REVALIDATION_SECRET);
      return { ok: !invalidateFails };
    }
    if (url.endsWith('/admin/oauth/access_token')) {
      const body = Object.fromEntries(new URLSearchParams(options.body));
      assert.equal(body.grant_type, 'client_credentials');
      assert.equal(body.client_secret, process.env.SHOPIFY_CLIENT_SECRET);
      return { ok: true, json: async () => ({ access_token: 'flow-issued-admin-token', expires_in: 86399 }) };
    }
    const { query, variables } = JSON.parse(options.body);
    let data;
    if (url.includes('/admin/api/')) {
      assert.equal(options.headers['X-Shopify-Access-Token'], 'flow-issued-admin-token');
      assert.notEqual(options.headers['X-Shopify-Access-Token'], process.env.SHOPIFY_CLIENT_SECRET);
      if (query.includes('CreateCodOrder')) {
        assert.equal(variables.order.financialStatus, 'PENDING');
        assert.equal(variables.options.inventoryBehaviour, 'DECREMENT_OBEYING_POLICY');
        assert.equal(variables.order.lineItems[0].variantId, variantId);
        assert.equal(variables.order.lineItems[0].priceSet.shopMoney.amount, '20');
        assert.equal(variables.order.currency, 'BDT');
        data = { orderCreate: codFails ? { order: null, userErrors: [{ message: 'Insufficient inventory' }] }
          : { order: { id: 'gid://shopify/Order/41', name: '#COD41', totalPriceSet: { presentmentMoney: { amount: '49.00', currencyCode: 'BDT' } } }, userErrors: [] } };
      } else if (query.includes('CodOrderStatus')) {
        data = { order: { cancelledAt: null } };
      } else if (query.includes('FindCodOrder')) {
        data = { orders: { nodes: [] } };
      } else if (query.includes('CancelCodOrder')) {
        data = { orderCancel: { job: { id: 'gid://shopify/Job/1', done: true }, userErrors: [], orderCancelUserErrors: [] } };
      } else throw Error('Unexpected Admin request');
    } else {
      assert.equal(options.headers['X-Shopify-Storefront-Access-Token'], process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN);
      assert.equal(options.headers['X-Shopify-Access-Token'], undefined);
      if (query.includes('CartVariants')) {
        onlineFetches++;
        if (variables.countryCode) { assert.equal(variables.countryCode, expectedCountry); assert.match(query, /@inContext\(country: \$countryCode\)/); }
        data = { nodes: [unavailable ? null : variant(variables.countryCode === 'SA' ? { price: { amount: '35.00', currencyCode: 'SAR' } } : {})] };
      }
      else if (query.includes('CartCreate')) {
        assert.deepEqual(variables.input.lines, [{ merchandiseId: variantId, quantity: 2 }]);
        onlineFetches++;
        assert.equal(variables.input.buyerIdentity.countryCode, expectedCountry);
        assert.match(query, /buyerIdentity \{ countryCode \}/);
        assert.equal(variables.input.buyerIdentity.email, address.email);
        assert.equal(variables.input.attributes[0].key, 'tech_hub_checkout_id');
        data = { cartCreate: { cart: { id: 'gid://shopify/Cart/test', checkoutUrl: 'https://test-shop.myshopify.com/checkouts/test' }, userErrors: [] } };
      } else if (query.includes('Catalog')) data = { products: { nodes: [product()], pageInfo: { hasNextPage: false } } };
      else if (query.includes('ProductDetail')) data = { product: product() };
      else throw Error('Unexpected Storefront request');
    }
    return { ok: true, json: async () => ({ data }) };
  });
  const request = (path, body, method = 'POST') => fetch(base + path, { method, headers: {
    'content-type': 'application/json', authorization: 'Bearer ' + token,
  }, body: body ? JSON.stringify(body) : undefined });
  async function deliver(topic, id, raw, overrides = {}) {
    const signature = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET).update(raw).digest('base64');
    return fetch(base + '/api/shopify/webhooks', { method: 'POST', headers: {
      'content-type': 'application/json', 'x-shopify-hmac-sha256': signature, 'x-shopify-topic': topic,
      'x-shopify-webhook-id': id, 'x-shopify-shop-domain': 'test-shop.myshopify.com', ...overrides,
    }, body: raw });
  }
  try {
    await t.test('product listing/details and quote never access MongoDB products', async () => {
      const list = await request('/api/products', null, 'GET');
      assert.equal(list.status, 200); assert.equal((await list.json()).products[0]._id, productId);
      assert.equal((await request('/api/products/test-phone', null, 'GET')).status, 200);
      const quote = await request('/api/products/quote', { items: [{ variantId, quantity: 2, price: .01 }] });
      assert.equal(quote.status, 200); assert.equal((await quote.json()).products[0].price, 20);
    });
    await t.test('COD validates Shopify price and creates pending order with Shopify inventory policy', async () => {
      const response = await request('/api/orders', { items: [{ variantId, quantity: 2, price: .01, name: 'Fake' }],
        shippingAddress: address, idempotencyKey: 'cod-test-1', totalAmount: 1, paymentStatus: 'paid' });
      assert.equal(response.status, 201, await response.clone().text());
      const { order } = await response.json();
      assert.equal(order.totalAmount, 49); assert.equal(order.paymentStatus, 'pending');
      assert.equal(order.products[0].product, productId); assert.equal(order.products[0].variantId, variantId);
      assert.equal(order.products[0].price, 20); assert.equal(order.shopifyOrderId, 'gid://shopify/Order/41');
      assert.equal(order.currencyCode, 'BDT'); assert.equal(shopifyOrder, undefined);
    });
    await t.test('COD retry reuses the saved order without creating another Shopify order', async () => {
      const response = await request('/api/orders', { idempotencyKey: 'cod-test-1' });
      assert.equal(response.status, 200); assert.equal((await response.json()).order._id, codOrder.id);
    });
    await t.test('COD cancellation restocks through Shopify', async () => {
      const response = await request('/api/orders/' + codOrder.id + '/status', { orderStatus: 'cancelled' }, 'PUT');
      // A regular customer cannot operate admin order status.
      assert.equal(response.status, 403);
      const { cancelCodOrder } = require('../services/cod');
      assert.equal((await cancelCodOrder(codOrder.shopifyOrderId)).done, true);
    });
    await t.test('unavailable variant and malformed quantities reject both checkout paths', async () => {
      unavailable = true;
      for (const path of ['/api/orders','/api/shopify/checkout']) assert.equal((await request(path, {
        items: [{ variantId, quantity: 2 }], shippingAddress: address, idempotencyKey: 'unavailable-checkout-' + (path === '/api/orders' ? 'cod' : 'online'),
      })).status, 409);
      unavailable = false;
      assert.equal((await request('/api/orders', { items: [{ productId, quantity: 2 }], shippingAddress: address })).status, 400);
    });
    await t.test('COD Shopify rejection does not report a successful order', async () => {
      codFails = true;
      const response = await request('/api/orders', { items: [{ variantId, quantity: 2 }], shippingAddress: address, idempotencyKey: 'cod-fail-test' });
      assert.equal(response.status, 409); codFails = false;
    });
    await t.test('definite COD rejection can be retried safely with the same reference', async () => {
      const previous = codOrder.id;
      const response = await request('/api/orders', { items: [{ variantId, quantity: 2 }], shippingAddress: address, idempotencyKey: 'cod-fail-test' });
      assert.equal(response.status, 201); assert.equal((await response.json()).order._id, previous);
      assert.equal(codOrder.creationStatus, 'ready');
    });
    await t.test('Shopify Checkout uses returned variant GID and remains pending', async () => {
      const response = await request('/api/shopify/checkout', { items: [{ variantId, quantity: 2 }], shippingAddress: address, price: .01 });
      assert.equal(response.status, 201); assert.equal((await response.json()).checkoutId, checkout.id);
      assert.equal(checkout.status, 'pending'); assert.equal(checkout.items[0].product, productId);
      const status = await request('/api/shopify/checkout/' + checkout.id + '/status', null, 'GET');
      assert.equal((await status.json()).checkout.status, 'pending');
    });
    await t.test('SA and US shipping context flows through validation and cartCreate', async () => {
      for (const countryCode of ['SA', 'US']) {
        expectedCountry = countryCode;
        const quote = await request('/api/products/quote', { items: [{ variantId, quantity: 2 }], countryCode });
        assert.equal(quote.status, 200);
        assert.equal((await quote.json()).products[0].currencyCode, countryCode === 'SA' ? 'SAR' : 'BDT');
        const response = await request('/api/shopify/checkout', { items: [{ variantId, quantity: 2 }], shippingAddress: { ...address, countryCode } });
        assert.equal(response.status, 201);
        assert.equal(checkout.shippingAddress.countryCode, countryCode);
        assert.equal(checkout.items[0].price, countryCode === 'SA' ? 35 : 20);
        assert.equal(checkout.items[0].currencyCode, countryCode === 'SA' ? 'SAR' : 'BDT');
      }
      expectedCountry = 'BD';
    });
    await t.test('invalid shipping countries fail before Shopify calls', async () => {
      const before = onlineFetches;
      for (const countryCode of [undefined, null, '', 'ZZ', 'XX', 'SAU', 'sa', ' SA ', 123, ['SA'], { code: 'SA' }, 'Saudi Arabia']) {
        const response = await request('/api/shopify/checkout', { items: [{ variantId, quantity: 2 }], shippingAddress: { ...address, countryCode } });
        assert.equal(response.status, 400);
        if (countryCode !== undefined) assert.equal((await request('/api/products/quote', { items: [{ variantId, quantity: 2 }], countryCode })).status, 400);
      }
      assert.equal(onlineFetches, before);
    });
    const paid = JSON.stringify({ id: 42, admin_graphql_api_id: 'gid://shopify/Order/42', name: '#TEST42',
      total_price: '60.00', currency: 'BDT', email: address.email,
      note_attributes: [{ name: 'tech_hub_checkout_id', value: checkout.id }],
      line_items: [{ product_id: 456, variant_id: 123, name: 'Paid phone', price: '20.00', quantity: 3 }],
    }, null, 2) + '\n';
    await t.test('invalid HMAC, reserialized bytes and wrong shop reject all processing', async () => {
      assert.equal((await deliver('orders/paid','bad',paid,{ 'x-shopify-hmac-sha256': 'forged' })).status, 401);
      const altered = crypto.createHmac('sha256',process.env.SHOPIFY_WEBHOOK_SECRET).update(JSON.stringify(JSON.parse(paid))).digest('base64');
      assert.equal((await deliver('orders/paid','altered',paid,{ 'x-shopify-hmac-sha256': altered })).status, 401);
      assert.equal((await deliver('orders/paid','shop',paid,{ 'x-shopify-shop-domain': 'other.myshopify.com' })).status, 401);
      assert.equal(checkout.status, 'pending');
    });
    await t.test('paid webhook uses actual Shopify lines even if buyer changed quantities', async () => {
      assert.equal((await deliver('orders/paid','paid-1',paid)).status, 200);
      assert.equal(shopifyOrder.paymentStatus, 'paid'); assert.equal(shopifyOrder.totalAmount, 60);
      assert.equal(shopifyOrder.products[0].quantity, 3); assert.equal(shopifyOrder.products[0].name, 'Paid phone');
      assert.equal(checkout.status, 'paid'); assert.equal(creates, 1);
    });
    await t.test('paid replays do not duplicate orders or change MongoDB inventory', async () => {
      assert.equal(await (await deliver('orders/paid','paid-1',paid)).text(), 'Already processed');
      assert.equal((await deliver('orders/paid','paid-2',paid)).status, 200); assert.equal(creates, 1);
    });
    await t.test('refund webhook locates Shopify order and preserves existing refund behavior', async () => {
      const raw = JSON.stringify({ id: 99, order_id: 42 });
      assert.equal((await deliver('refunds/create','refund-1',raw)).status, 200);
      assert.equal(shopifyOrder.paymentStatus, 'refunded');
      assert.equal(await (await deliver('refunds/create','refund-1',raw)).text(), 'Already processed');
    });
    await t.test('product create/update/delete invalidate shared Next catalog and retries remain safe', async () => {
      for (const topic of ['products/create','products/update','products/delete']) {
        const raw = '{ "id": 456 }\n';
        assert.equal((await deliver(topic,topic,raw)).status, 200);
        assert.equal((await deliver(topic,topic,raw)).status, 200);
        assert.equal((await deliver(topic,'forged',raw,{ 'x-shopify-hmac-sha256': 'forged' })).status, 401);
      }
      assert.equal(invalidations, 6);
      invalidateFails = true;
      assert.equal((await deliver('products/update','retry','{"id":456}')).status, 502);
      invalidateFails = false;
      assert.equal((await deliver('products/update','retry','{"id":456}')).status, 200);
    });
    await t.test('unknown topics and malformed checkout IDs cannot query invalid MongoDB IDs', async () => {
      assert.equal(await (await deliver('unknown/topic','unknown','{}')).text(), 'Ignored');
      assert.equal(await (await deliver('orders/paid','unmapped','{"id":999,"note_attributes":[{"name":"tech_hub_checkout_id","value":"bad"}]}')).text(), 'Ignored');
    });
  } finally {
    restores.reverse().forEach(restore => restore()); server.close(); await once(server, 'close');
  }
});
