const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'application-data-test-secret';
process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'test-storefront-token';
const app = require('../server');
const User = require('../models/User');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { product, productId } = require('./fixtures');
test('reviews and wishlists retain MongoDB application data with Shopify product references', async () => {
  const original = { user: User.findById, create: Review.create, find: Review.find, fetch: global.fetch, exists: Product.exists };
  const user = { id: '507f1f77bcf86cd799439011', role: 'user', wishlist: [], save: async () => {} };
  User.findById = async () => user;
  Product.exists = () => { throw Error('Legacy product model is not a catalog'); };
  Review.create = async data => { const review = new Review(data); await review.validate(); return review; };
  Review.find = query => {
    assert.equal(query.product, productId);
    return { populate: () => ({ sort: () => ({ limit: async () => [{ rating: 5, product: productId, comment: 'Good', user: { name: 'Buyer' } }] }) }) };
  };
  const server = app.listen(0); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  global.fetch = async (url, options) => url.startsWith(base) ? original.fetch(url, options)
    : { ok: true, json: async () => ({ data: { product: product() } }) };
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET);
  async function request(path, method = 'GET', body) {
    return fetch(base + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined });
  }
  try {
    const path = '/api/auth/wishlist/' + encodeURIComponent(productId);
    assert.equal((await request(path,'PUT')).status,200);
    assert.deepEqual(user.wishlist,[productId]);
    const wishlist = await request('/api/auth/wishlist');
    assert.equal((await wishlist.json()).products[0]._id,productId);
    const reviewPath = '/api/products/' + encodeURIComponent(productId) + '/reviews';
    const posted = await request(reviewPath,'POST',{ rating: 5, comment: 'Good' });
    assert.equal(posted.status,201); assert.equal((await posted.json()).review.product,productId);
    assert.equal((await request(reviewPath,'POST',{ rating: 6 })).status,400);
    assert.equal((await (await request(reviewPath)).json()).reviews[0].user.name,'Buyer');
    assert.equal((await request(path,'PUT')).status,200); assert.deepEqual(user.wishlist,[]);
  } finally {
    User.findById = original.user; Review.create = original.create; Review.find = original.find;
    Product.exists = original.exists; global.fetch = original.fetch; server.close(); await once(server,'close');
  }
});
