const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAdminTokenProvider } = require('../services/shopifyAdminAuth');
const config = { domain: 'test-shop.myshopify.com', clientId: 'test-client-id', clientSecret: 'test-client-secret' };
const reply = (token = 'issued-admin-token', seconds = 86399) => ({ ok: true, status: 200,
  json: async () => ({ access_token: token, expires_in: seconds, scope: 'read_products,write_products,write_orders,read_orders' }) });
test('client credentials token acquisition, caching and renewal', async (t) => {
  await t.test('exchanges credentials server-side and caches issued token until refresh margin', async () => {
    let time = 1000, acquisitions = 0;
    const provider = createAdminTokenProvider({ credentials: () => config, now: () => time,
      fetchImpl: async (url, options) => {
        acquisitions++;
        assert.equal(url, 'https://test-shop.myshopify.com/admin/oauth/access_token');
        assert.equal(options.method, 'POST'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
        assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
        assert.equal(options.headers['X-Shopify-Access-Token'], undefined);
        assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)), {
          grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret,
        });
        return reply('issued-token-' + acquisitions);
      } });
    assert.equal((await provider.getAccess()).token, 'issued-token-1');
    time = 1000 + 86399 * 1000 - 60001;
    assert.equal((await provider.getAccess()).token, 'issued-token-1'); assert.equal(acquisitions, 1);
    time++;
    assert.equal((await provider.getAccess()).token, 'issued-token-2'); assert.equal(acquisitions, 2);
    assert.deepEqual(await provider.getAccess(), { domain: config.domain, token: 'issued-token-2' });
  });
  await t.test('concurrent requests share one token acquisition per warm instance', async () => {
    let resolve, acquisitions = 0;
    const provider = createAdminTokenProvider({ credentials: () => config,
      fetchImpl: async () => { acquisitions++; return new Promise(done => { resolve = done; }); } });
    const requests = Array.from({ length: 20 }, () => provider.getAccess());
    assert.equal(acquisitions, 1);
    resolve(reply());
    const results = await Promise.all(requests);
    assert.ok(results.every(result => result.token === 'issued-admin-token'));
  });
  await t.test('acquisition failures are shared, redacted, and recover on the next request', async () => {
    let acquisitions = 0, fails = true;
    const provider = createAdminTokenProvider({ credentials: () => config, fetchImpl: async () => {
      acquisitions++;
      if (fails) throw Error(config.clientSecret + ' https://test-shop.myshopify.com');
      return reply();
    } });
    const results = await Promise.allSettled([provider.getAccess(),provider.getAccess()]);
    assert.equal(acquisitions, 1);
    for (const result of results) {
      assert.equal(result.status,'rejected'); assert.equal(result.reason.status,502);
      assert.ok(!result.reason.message.includes(config.clientSecret));
      assert.equal(result.reason.cause,undefined);
    }
    fails = false;
    assert.equal((await provider.getAccess()).token,'issued-admin-token'); assert.equal(acquisitions,2);
  });
  await t.test('expired cache never falls back to an old token on refresh failure', async () => {
    let time = 0, fails = false;
    const provider = createAdminTokenProvider({ credentials: () => config, now: () => time,
      fetchImpl: async () => fails ? { ok: false, status: 401, json: async () => ({ error: config.clientSecret }) } : reply() });
    await provider.getAccess();
    time = 86400 * 1000; fails = true;
    await assert.rejects(provider.getAccess(), error => error.status === 502 && !error.message.includes(config.clientSecret));
    fails = false; assert.equal((await provider.getAccess()).token,'issued-admin-token');
  });
  await t.test('invalid responses and credentials masquerading as tokens fail closed', async () => {
    for (const body of [
      null, {}, { access_token: config.clientSecret, expires_in: 86399 }, { access_token: config.clientId, expires_in: 86399 },
      { access_token: 'bad\r\nheader', expires_in: 86399 }, { access_token: 'token', expires_in: '86399' },
      { access_token: 'token', expires_in: 0 }, { access_token: 'token', expires_in: -1 },
      { access_token: 'token', expires_in: Infinity }, { access_token: 'token', expires_in: 1000000 },
    ]) {
      const provider = createAdminTokenProvider({ credentials: () => config,
        fetchImpl: async () => ({ ok: true, json: async () => body }) });
      await assert.rejects(provider.getAccess(), { status: 502 });
    }
    const provider = createAdminTokenProvider({ credentials: () => config,
      fetchImpl: async () => ({ ok: true, json: async () => { throw Error(config.clientSecret); } }) });
    await assert.rejects(provider.getAccess(), { status: 502 });
  });
  await t.test('credential/store rotation and stale invalidations cannot reuse old authentication', async () => {
    let current = config, acquisitions = 0;
    const provider = createAdminTokenProvider({ credentials: () => current, fetchImpl: async () => reply('token-' + ++acquisitions) });
    const old = await provider.getAccess();
    provider.invalidate(old.token); assert.equal((await provider.getAccess()).token,'token-2');
    provider.invalidate(old.token); assert.equal((await provider.getAccess()).token,'token-2');
    current = { ...config, clientSecret: 'rotated-secret' }; assert.equal((await provider.getAccess()).token,'token-3');
    current = { ...current, domain: 'other-shop.myshopify.com' }; assert.equal((await provider.getAccess()).domain,current.domain);
    assert.equal(acquisitions,4);
  });
  await t.test('an acquisition that completes after its usable lifetime is rejected', async () => {
    let time = 0;
    const provider = createAdminTokenProvider({ credentials: () => config, now: () => time,
      fetchImpl: async () => { time = 6000; return reply('short-token',5); } });
    await assert.rejects(provider.getAccess(),{ status: 502 });
  });
});
test('Admin client renews after 401 while preserving mutation safety and separate Storefront auth', async (t) => {
  const originalFetch = global.fetch;
  const previous = {};
  for (const [key,value] of Object.entries({
    SHOPIFY_STORE_DOMAIN: config.domain, SHOPIFY_CLIENT_ID: config.clientId, SHOPIFY_CLIENT_SECRET: config.clientSecret,
    SHOPIFY_ADMIN_ACCESS_TOKEN: 'obsolete-static-token', SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'public-storefront-token',
  })) { previous[key] = process.env[key]; process.env[key] = value; }
  const { adminRequest } = require('../services/catalog');
  const { createCart } = require('../services/shopify');
  let tokenCalls = 0, graphCalls = 0, mode = '401-once';
  try {
    global.fetch = async (url, options) => {
      if (url.endsWith('/admin/oauth/access_token')) { tokenCalls++; return reply('runtime-token-' + tokenCalls); }
      assert.ok(url.includes('/admin/api/'));
      graphCalls++;
      assert.equal(options.headers['X-Shopify-Access-Token'],'runtime-token-' + tokenCalls);
      assert.notEqual(options.headers['X-Shopify-Access-Token'],config.clientSecret);
      if (mode === 'network') throw Error(config.clientSecret);
      if (mode === '401-once' && graphCalls === 1 || mode === '401-always') return { ok: false, status: 401, body: { cancel: async () => { throw Error(config.clientSecret); } }, json: async () => ({ error: config.clientSecret }) };
      if (mode === '403' || mode === '500') return { ok: false, status: Number(mode), json: async () => ({ error: config.clientSecret }) };
      if (mode === 'graphql-error') return { ok: true, status: 200, json: async () => ({ errors: [{ message: config.clientSecret }] }) };
      return { ok: true, status: 200, json: async () => ({ data: { productUpdate: { product: { id: 'gid://shopify/Product/1' }, userErrors: [] } } }) };
    };
    await t.test('explicit 401 reacquires token once and repeats the identical request', async () => {
      const result = await adminRequest('mutation { productUpdate { product { id } } }',{});
      assert.equal(result.productUpdate.product.id,'gid://shopify/Product/1');
      assert.equal(tokenCalls,2); assert.equal(graphCalls,2);
    });
    await t.test('network/5xx/403/GraphQL errors do not replay mutations or leak credentials', async () => {
      for (const failure of ['network','500','403','graphql-error']) {
        mode = failure; const before = graphCalls, beforeTokens = tokenCalls;
        await assert.rejects(adminRequest('mutation { orderCreate { order { id } } }',{}),
          error => error.status === 502 && !error.message.includes(config.clientSecret));
        assert.equal(graphCalls,before + 1); assert.equal(tokenCalls,beforeTokens);
      }
    });
    await t.test('repeated 401 stops after one renewal and invalidates the rejected token', async () => {
      mode = '401-always'; const before = graphCalls, beforeTokens = tokenCalls;
      await assert.rejects(adminRequest('query { shop { id } }',{}),{ status: 502 });
      assert.equal(graphCalls,before + 2); assert.equal(tokenCalls,beforeTokens + 1);
      mode = 'success';
      await adminRequest('query { shop { id } }',{});
      assert.equal(tokenCalls,beforeTokens + 2);
    });
    await t.test('Storefront cartCreate never acquires an Admin token or sends app credentials', async () => {
      const beforeTokens = tokenCalls;
      global.fetch = async (url,options) => {
        assert.ok(!url.includes('/admin/'));
        assert.equal(options.headers['X-Shopify-Storefront-Access-Token'],'public-storefront-token');
        assert.equal(options.headers['X-Shopify-Access-Token'],undefined);
        assert.ok(!options.body.includes(config.clientSecret));
        return { ok: true, json: async () => ({ data: { cartCreate: { cart: {
          id: 'gid://shopify/Cart/test', checkoutUrl: 'https://test-shop.myshopify.com/checkouts/test',
        }, userErrors: [] } } }) };
      };
      await createCart({ lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1',quantity: 1 }],email: 'buyer@example.com',countryCode: 'BD',checkoutId: 'local-checkout' });
      assert.equal(tokenCalls,beforeTokens);
    });
    await t.test('invalid domain or missing credentials fail before requesting tokens, even with a static token set', async () => {
      global.fetch = async () => { throw Error('Must not fetch'); };
      for (const [key,value] of [['SHOPIFY_CLIENT_ID',''],['SHOPIFY_CLIENT_SECRET',''],['SHOPIFY_STORE_DOMAIN','https://evil.example/path']]) {
        const original = process.env[key]; process.env[key] = value;
        try { await assert.rejects(adminRequest('query { shop { id } }',{}),{ status: 503 }); }
        finally { process.env[key] = original; }
      }
    });
  } finally {
    global.fetch = originalFetch;
    for (const [key,value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
