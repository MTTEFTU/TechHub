const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'test-storefront-token';
const catalog = require('../services/catalog');
const { variant, product, variantId, productId } = require('./fixtures');
function response(data) { return { ok: true, json: async () => ({ data }) }; }
test('Shopify catalog listing, details, pagination, options, prices and availability', async (t) => {
  const original = global.fetch;
  try {
    await t.test('listing uses Storefront token and returns Shopify fields without MongoDB', async () => {
      global.fetch = async (url, options) => {
        assert.ok(url.includes('/api/'));
        assert.equal(options.headers['X-Shopify-Storefront-Access-Token'], process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN);
        assert.equal(options.headers['X-Shopify-Access-Token'], undefined);
        return response({ products: { nodes: [product()], pageInfo: { hasNextPage: false } } });
      };
      const [p] = await catalog.listProducts();
      assert.equal(p._id, productId); assert.equal(p.handle, 'test-phone'); assert.equal(p.price, 20);
      assert.equal(p.compareAtPrice, 25); assert.equal(p.vendor, 'Test'); assert.equal(p.productType, 'Phones');
      assert.deepEqual(p.tags, ['featured']); assert.equal(p.variants[0].id, variantId);
      assert.deepEqual(p.variants[0].selectedOptions, [{ name: 'Color', value: 'Black' }]);
      assert.equal(p.variants[0].quantityAvailable, 10); assert.equal(p.images[0], 'https://cdn.shopify.com/test.jpg');
      assert.equal((await catalog.listProducts({ search: 'missing' })).length, 0);
      assert.equal((await catalog.listProducts({ category: 'Laptops' })).length, 0);
      assert.equal((await catalog.listProducts({ minPrice: '21' })).length, 0);
      assert.equal((await catalog.listProducts({ maxPrice: '19' })).length, 0);
      assert.equal((await catalog.listProducts({ featured: 'true', inStock: 'true' })).length, 1);
    });
    await t.test('all product and variant pages are followed', async () => {
      global.fetch = async (_url, options) => {
        const { query, variables } = JSON.parse(options.body);
        if (query.includes('VariantPage')) return response({ node: { variants: { nodes: [variant({ id: 'gid://shopify/ProductVariant/124' })], pageInfo: { hasNextPage: false } } } });
        return response({ products: { nodes: [product({ id: variables.after ? 'gid://shopify/Product/457' : productId,
          variants: { nodes: [variant()], pageInfo: { hasNextPage: !variables.after, endCursor: 'variants-next' } } })],
          pageInfo: { hasNextPage: !variables.after, endCursor: 'products-next' } } });
      };
      const all = await catalog.listProducts();
      assert.equal(all.length, 2); assert.equal(all[0].variants.length, 2);
    });
    await t.test('details accept handles and product GIDs and reject invalid identifiers', async () => {
      global.fetch = async (_url, options) => {
        const { variables } = JSON.parse(options.body);
        assert.ok(variables.id === productId || variables.handle === 'test-phone');
        return response({ product: product() });
      };
      assert.equal((await catalog.getProduct('test-phone'))._id, productId);
      assert.equal((await catalog.getProduct(productId)).handle, 'test-phone');
      await assert.rejects(catalog.getProduct(variantId), { status: 400 });
      global.fetch = async () => response({ product: null });
      assert.equal(await catalog.getProduct('deleted'), null);
    });
    await t.test('sort and stock filters use Shopify prices and availability', async () => {
      global.fetch = async () => response({ products: { nodes: [product(), product({
        id: 'gid://shopify/Product/457', availableForSale: false, variants: { nodes: [variant({
          availableForSale: false, price: { amount: '10', currencyCode: 'BDT' } })] },
      })], pageInfo: { hasNextPage: false } } });
      assert.deepEqual((await catalog.listProducts({ sort: 'price-asc' })).map(p => p.price), [10,20]);
      assert.deepEqual((await catalog.listProducts({ sort: 'price-desc' })).map(p => p.price), [20,10]);
      assert.equal((await catalog.listProducts({ inStock: 'true' })).length, 1);
    });
    await t.test('checkout ignores browser prices/names and combines quantities by variant', async () => {
      global.fetch = async (_url, options) => {
        assert.deepEqual(JSON.parse(options.body).variables.ids, [variantId]);
        return response({ nodes: [variant()] });
      };
      const lines = await catalog.validateLines([{ variantId, quantity: 2, price: .01, name: 'Fake' }, { variantId, quantity: 1 }]);
      assert.equal(lines.length, 1); assert.equal(lines[0].price, 20); assert.equal(lines[0].quantity, 3);
      assert.equal(lines[0].name, 'Test phone — Black');
      for (const items of [[], [{ variantId: productId, quantity: 1 }], [{ variantId, quantity: 0 }], [{ variantId, quantity: 1.5 }],
        [{ variantId, quantity: 99 }, { variantId, quantity: 2 }]]) await assert.rejects(catalog.validateLines(items), { status: 400 });
    });
    await t.test('deleted, unpublished, sold out, insufficient stock and invalid prices fail closed', async () => {
      for (const v of [null, variant({ availableForSale: false }), variant({ quantityAvailable: 0 }),
        variant({ product: { availableForSale: false } })]) {
        global.fetch = async () => response({ nodes: [v] });
        await assert.rejects(catalog.validateLines([{ variantId, quantity: 1 }]), { status: 409 });
      }
      global.fetch = async () => response({ nodes: [variant({ price: { amount: 'bad', currencyCode: 'BDT' } })] });
      await assert.rejects(catalog.validateLines([{ variantId, quantity: 1 }]), { status: 502 });
      for (const v of [variant({ quantityAvailable: null }), variant({ quantityAvailable: 0, currentlyNotInStock: true })]) {
        global.fetch = async () => response({ nodes: [v] });
        assert.equal((await catalog.validateLines([{ variantId, quantity: 1 }])).length, 1);
      }
    });
  } finally { global.fetch = original; }
});
