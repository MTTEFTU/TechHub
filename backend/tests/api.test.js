const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const crypto = require('node:crypto');
process.env.NODE_ENV = 'test';
const app = require('../server');
const { verifyWebhook } = require('../services/shopify');

test('API health, CORS, protected admin boundary, and missing routes', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const admin = await fetch(`${origin}/api/admin/stats`, { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(admin.status, 401);
    assert.equal(admin.headers.get('access-control-allow-origin'), 'http://localhost:3000');

    for (const [path, method] of [
      ['/api/auth/profile', 'GET'],
      ['/api/orders', 'POST'],
      ['/api/shopify/checkout', 'POST'],
    ]) {
      const response = await fetch(`${origin}${path}`, { method });
      assert.equal(response.status, 401, `${method} ${path} should require authentication`);
    }

    const missing = await fetch(`${origin}/api/not-a-route`);
    assert.equal(missing.status, 404);

    const forgedWebhook = await fetch(`${origin}/api/shopify/webhooks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-hmac-sha256': 'not-valid' },
      body: JSON.stringify({ id: 1 }),
    });
    assert.equal(forgedWebhook.status, 401);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Shopify webhook signatures cover the exact raw request body', () => {
  const previousSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const secret = 'test-webhook-signing-secret';
  const rawBody = Buffer.from('{"id":42, "financial_status":"paid"}');
  process.env.SHOPIFY_WEBHOOK_SECRET = secret;
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  try {
    assert.equal(verifyWebhook(rawBody, signature), true);
    assert.equal(verifyWebhook(Buffer.from(JSON.stringify(JSON.parse(rawBody.toString()))), signature), false);
  } finally {
    if (previousSecret === undefined) delete process.env.SHOPIFY_WEBHOOK_SECRET;
    else process.env.SHOPIFY_WEBHOOK_SECRET = previousSecret;
  }
});
