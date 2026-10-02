const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'admin-test-secret';
process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'storefront-test-token';
process.env.SHOPIFY_CLIENT_ID = 'admin-test-client-id';
process.env.SHOPIFY_CLIENT_SECRET = 'admin-test-client-secret';
process.env.SHOPIFY_REVALIDATION_URL = 'https://frontend.example/api/catalog/revalidate';
process.env.SHOPIFY_REVALIDATION_SECRET = 'cache-test-secret';
const app = require('../server');
const User = require('../models/User');
const catalog = require('../services/catalog');
const { productId, variantId } = require('./fixtures');
test('Tech Hub admin edits Shopify using server-only credentials and current variant mutations', async (t) => {
  const originalFetch = global.fetch, originalUser = User.findById;
  let role = 'admin', rejectVariants = false;
  const calls = [];
  User.findById = async () => ({ id: '507f1f77bcf86cd799439011', role });
  const server = app.listen(0); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  global.fetch = async (url, options) => {
    if (url.startsWith(base)) return originalFetch(url, options);
    if (url === process.env.SHOPIFY_REVALIDATION_URL) { calls.push({ invalidate: true }); return { ok: true }; }
    if (url.endsWith('/admin/oauth/access_token')) {
      const body = Object.fromEntries(new URLSearchParams(options.body));
      assert.equal(body.grant_type, 'client_credentials');
      assert.equal(body.client_secret, process.env.SHOPIFY_CLIENT_SECRET);
      return { ok: true, json: async () => ({ access_token: 'admin-issued-test-token', expires_in: 86399 }) };
    }
    assert.equal(options.headers['X-Shopify-Access-Token'], 'admin-issued-test-token');
    assert.notEqual(options.headers['X-Shopify-Access-Token'], process.env.SHOPIFY_CLIENT_SECRET);
    assert.equal(options.headers['X-Shopify-Storefront-Access-Token'], undefined);
    assert.equal(options.cache, 'no-store');
    const input = JSON.parse(options.body); calls.push(input);
    let data;
    if (input.query.includes('CreateProduct')) data = { productCreate: { product: { id: productId }, userErrors: [] } };
    else if (input.query.includes('UpdateProduct')) data = { productUpdate: { product: { id: productId }, userErrors: [] } };
    else if (input.query.includes('UpdateVariants')) data = { productVariantsBulkUpdate: { productVariants: [{ id: variantId }], userErrors: rejectVariants ? [{ message: 'Invalid options' }] : [] } };
    else if (input.query.includes('DeleteProduct')) data = { productDelete: { deletedProductId: productId, userErrors: [] } };
    else if (input.query.includes('Catalog')) data = { products: { nodes: [{
      id: productId, handle: 'draft-phone', title: 'Draft phone', description: '', descriptionHtml: '',
      vendor: 'Test', productType: 'Phones', tags: [], status: 'DRAFT', options: [],
      images: { nodes: [] }, variants: { nodes: [{
        id: variantId, title: 'Black', price: '20.00', compareAtPrice: '25.00', inventoryQuantity: 5,
        selectedOptions: [{ name: 'Color', value: 'Black' }],
      }], pageInfo: { hasNextPage: false } },
    }], pageInfo: { hasNextPage: false } } };
    else throw Error('Unexpected query');
    return { ok: true, json: async () => ({ data }) };
  };
  const save = (method, body, authorized = true) => fetch(base + '/api/products' + (method === 'POST' ? '' : '/' + encodeURIComponent(productId)), {
    method, headers: { 'content-type': 'application/json', ...(authorized ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  try {
    await t.test('authentication and admin role are required', async () => {
      assert.equal((await save('POST', {}, false)).status, 401);
      role = 'user'; assert.equal((await save('POST', {})).status, 403); role = 'admin';
      assert.equal(calls.length, 0);
    });
    await t.test('creates draft in Shopify and invalidates cache without local product record', async () => {
      const response = await save('POST', { title: 'New phone', descriptionHtml: '<p>Phone</p>', vendor: 'Test', productType: 'Phones', tags: ['featured'] });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).product.id, productId);
      assert.equal(calls[0].variables.input.status, 'DRAFT'); assert.equal(calls.at(-1).invalidate, true);
    });
    await t.test('admin product list includes unpublished drafts from Admin API', async () => {
      const response = await fetch(base + '/api/admin/products', { headers: { authorization: 'Bearer ' + token } });
      assert.equal(response.status, 200);
      const p = (await response.json()).products[0];
      assert.equal(p.status, 'DRAFT'); assert.equal(p.price, 20); assert.equal(p.variants[0].id, variantId);
      assert.equal(p.variants[0].price.amount, '20.00');
    });
    await t.test('productUpdate changes metadata and bulk variant mutation changes prices and optionValues', async () => {
      const response = await save('PUT', { title: 'Edited', descriptionHtml: '<p>Updated</p>', variants: [{
        id: variantId, price: '19.99', compareAtPrice: '29.99', selectedOptions: [{ name: 'Color', value: 'White' }],
      }] });
      assert.equal(response.status, 200, await response.clone().text());
      const update = calls.findLast(c => c.query?.includes('UpdateProduct'));
      assert.deepEqual(update.variables.input, { id: productId, title: 'Edited', descriptionHtml: '<p>Updated</p>' });
      const variants = calls.findLast(c => c.query?.includes('UpdateVariants'));
      assert.equal(variants.variables.productId, productId);
      assert.deepEqual(variants.variables.variants, [{ id: variantId, price: '19.99', compareAtPrice: '29.99',
        optionValues: [{ optionName: 'Color', name: 'White' }] }]);
      assert.ok(variants.query.includes('allowPartialUpdates: false'));
    });
    await t.test('malformed variant ID or price is rejected before any metadata update', async () => {
      const count = calls.length;
      assert.equal((await save('PUT', { title: 'Bad', variants: [{ id: productId, price: '10' }] })).status, 400);
      assert.equal((await save('PUT', { variants: [{ id: variantId, price: '-1' }] })).status, 400);
      assert.equal(calls.length, count);
    });
    await t.test('Shopify variant errors are surfaced and partly changed metadata cache is still invalidated', async () => {
      rejectVariants = true;
      assert.equal((await save('PUT', { title: 'Metadata saved', variants: [{ id: variantId, price: '20' }] })).status, 409);
      assert.equal(calls.at(-1).invalidate, true); rejectVariants = false;
    });
    await t.test('delete uses Shopify productDelete and invalidates cache', async () => {
      assert.equal((await save('DELETE', {})).status, 200);
      assert.equal(calls.findLast(c => c.query?.includes('DeleteProduct')).variables.input.id, productId);
      assert.equal(calls.at(-1).invalidate, true);
    });
    await t.test('admin token failures produce safe errors with no credential leakage', async () => {
      global.fetch = async () => ({ ok: false, json: async () => ({ errors: [{ message: process.env.SHOPIFY_CLIENT_SECRET }] }) });
      await assert.rejects(catalog.adminRequest('query { shop { id } }', {}), error => error.status === 502 && !error.message.includes(process.env.SHOPIFY_CLIENT_SECRET));
    });
  } finally { global.fetch = originalFetch; User.findById = originalUser; server.close(); await once(server, 'close'); }
});
