const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, 'shopify.app.toml');
const fragment = fs.readFileSync(path.join(root, 'shopify/webhooks.toml'), 'utf8').replace(/^\uFEFF/, '');
const begin = '# BEGIN TECH HUB WEBHOOKS';
const end = '# END TECH HUB WEBHOOKS';
if (!fs.existsSync(configPath)) {
  throw new Error('Run shopify app config link from the repository root and select the existing Tech Hub Integration app first.');
}
let config = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
if (!/^client_id\s*=\s*"[^"]+"/m.test(config)) throw new Error('Linked app client_id is missing.');
// Remove only our previous generated subscription, preserving downloaded app settings.
config = config.replace(/# BEGIN TECH HUB WEBHOOKS[\s\S]*?# END TECH HUB WEBHOOKS\s*/g, '');
if (/orders\/paid|refunds\/create/.test(config)) {
  throw new Error('An existing target subscription needs review. Remove only its orders/paid or refunds/create entries before rerunning; preserve other topics.');
}
const table = /^\[webhooks\][^\S\r\n]*\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m;
if (table.test(config)) {
  config = config.replace(table, (block) => {
    if (/^api_version\s*=/m.test(block)) {
      // Preserve the existing webhook API version rather than changing unrelated subscriptions.
      return block;
    }
    return block + 'api_version = "2026-07"\n\n';
  });
} else {
  config += '\n[webhooks]\napi_version = "2026-07"\n';
}
const subscriptions = fragment.slice(fragment.indexOf('[[webhooks.subscriptions]]')).trim();
fs.writeFileSync(configPath, config.trimEnd() + '\n\n' + begin + '\n' + subscriptions + '\n' + end + '\n');
console.log('Configured orders/paid and refunds/create in the linked app configuration. Review the diff before deploying.');
