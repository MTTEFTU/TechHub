const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const app = require('../server');

test('API health, CORS, protected admin boundary, and missing routes', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const admin = await fetch(`${origin}/api/admin/stats`, { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(admin.status, 401);
    assert.equal(admin.headers.get('access-control-allow-origin'), 'http://localhost:3000');

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
