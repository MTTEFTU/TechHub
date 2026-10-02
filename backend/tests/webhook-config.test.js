const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const helper = fs.readFileSync(require.resolve('../scripts/configure-shopify-webhooks'), 'utf8');
const fragment = fs.readFileSync(require('node:path').join(__dirname,'../../shopify/webhooks.toml'),'utf8');
function configure(config) {
  let written;
  vm.runInNewContext(helper, { __dirname: require('node:path').join(__dirname,'../scripts'), console: { log() {} },
    require: name => name === 'node:fs' ? {
      existsSync: () => true,
      readFileSync: path => path.endsWith('webhooks.toml') ? fragment : config,
      writeFileSync: (_path, value) => { written = value; },
    } : require(name),
  });
  return written;
}
test('webhook setup preserves app identity, unrelated scopes/subscriptions and existing API version', () => {
  const initial = 'client_id = "existing-app"\nname = "Existing"\n[access_scopes]\nscopes = "read_orders,read_customers"\n[webhooks]\napi_version = "2026-10"\n[[webhooks.subscriptions]]\ntopics = ["app/uninstalled"]\nuri = "https://existing.example/uninstall"\n';
  const result = configure(initial);
  assert.ok(result.includes('client_id = "existing-app"'));
  assert.ok(result.includes('scopes = "read_orders,read_customers,read_products,write_products,write_orders"'));
  assert.ok(result.includes('api_version = "2026-10"'));
  assert.ok(result.includes('topics = ["app/uninstalled"]'));
  for (const topic of ['orders/paid','refunds/create','products/create','products/update','products/delete']) assert.ok(result.includes(topic));
  assert.equal(configure(result),result);
});
