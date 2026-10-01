const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'mapping-test-only-secret';
const app = require('../server');
const Product = require('../models/Product');
const User = require('../models/User');
const variant = 'gid://shopify/ProductVariant/123456789'; // Synthetic test fixture only.
const productId = '507f1f77bcf86cd799439012';
const userId = '507f1f77bcf86cd799439011';

test('product schema accepts optional mappings and rejects non-variant GIDs', () => {
  for (const shopifyVariantId of ['', undefined, variant, '  ' + variant + '  ']) {
    const product = new Product({ name: 'Test', category: 'Test', price: 10, shopifyVariantId });
    assert.equal(product.validateSync(), undefined);
    assert.equal(product.shopifyVariantId, shopifyVariantId ? variant : '');
  }
  for (const shopifyVariantId of ['123456789', 'gid://shopify/Product/123', 'gid://shopify/ProductVariant/abc', 'https://shopify.com/variants/123']) {
    const product = new Product({ name: 'Test', category: 'Test', price: 10, shopifyVariantId });
    assert.ok(product.validateSync().errors.shopifyVariantId);
  }
});

test('admin product routes persist mappings, enforce validation and keep authentication', async () => {
  const originals = { user: User.findById, create: Product.create, update: Product.findByIdAndUpdate };
  let stored;
  let role = 'admin';
  User.findById = async () => ({ id: userId, role });
  Product.create = async (data) => {
    const product = new Product(data);
    await product.validate();
    stored = product;
    return product;
  };
  Product.findByIdAndUpdate = async (id, data, options) => {
    assert.equal(id, productId);
    assert.equal(options.runValidators, true);
    assert.equal(options.new, true);
    const product = new Product({ ...stored.toObject(), ...data });
    await product.validate();
    stored = product;
    return product;
  };
  const server = app.listen(0);
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
  const save = (method, body, authorized = true) => fetch(base + '/api/products' + (method === 'PUT' ? '/' + productId : ''), {
    method, headers: { 'content-type': 'application/json', ...(authorized ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  try {
    assert.equal((await save('POST', {}, false)).status, 401);
    role = 'user';
    assert.equal((await save('POST', {})).status, 403);
    role = 'admin';
    let response = await save('POST', { name: 'Test phone', category: 'Phones', price: 10, shopifyVariantId: variant });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).product.shopifyVariantId, variant);
    response = await save('PUT', { shopifyVariantId: 'gid://shopify/ProductVariant/987654321' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).product.shopifyVariantId, 'gid://shopify/ProductVariant/987654321');
    assert.equal((await save('PUT', { shopifyVariantId: 'gid://shopify/Product/123' })).status, 400);
    assert.equal(stored.shopifyVariantId, 'gid://shopify/ProductVariant/987654321');
    assert.equal((await save('POST', { name: 'Bad', category: 'Test', price: 10, shopifyVariantId: '123' })).status, 400);
    response = await save('PUT', { shopifyVariantId: '' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).product.shopifyVariantId, '');
  } finally {
    User.findById = originals.user;
    Product.create = originals.create;
    Product.findByIdAndUpdate = originals.update;
    server.close();
    await once(server, 'close');
  }
});
