const crypto = require('crypto');

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';

function config() {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = (process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '').trim();
  if (!domain || !token) throw Object.assign(new Error('Online payment is not configured.'), { status: 503 });
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) throw Object.assign(new Error('Online payment configuration is invalid.'), { status: 503 });
  return { domain, token };
}


// Development diagnostics only: never serialize requests, headers, carts, or entire responses.
function logStorefrontFailure(response, result, reason) {
  if (process.env.NODE_ENV !== 'development') return;
  const credentials = Object.entries(process.env)
    .filter(([key, value]) => value && /TOKEN|SECRET|PASSWORD|KEY|URI|DATABASE_URL/i.test(key))
    .map(([, value]) => value);
  function clean(value) {
    if (typeof value !== 'string') return undefined;
    let text = value;
    for (const credential of credentials) text = text.split(credential).join('[REDACTED]');
    return text
      .replace(/\b(?:shpat_|shpca_|shpss_|shpua_)[a-z0-9_-]+/gi, '[REDACTED]')
      .replace(/\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, '[REDACTED]')
      .replace(/(?:mongodb(?:\+srv)?:\/\/|https?:\/\/)[^\s"']+/gi, '[REDACTED_URL]')
      .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[REDACTED_EMAIL]')
      .slice(0, 2000);
  }
  function messages(entries) {
    return Array.isArray(entries) ? entries.slice(0, 20).map((entry) => ({
      message: clean(entry?.message),
      code: clean(entry?.code || entry?.extensions?.code),
      field: Array.isArray(entry?.field) ? entry.field.map(clean) : undefined,
      path: Array.isArray(entry?.path) ? entry.path.map((part) => typeof part === 'number' ? part : clean(part)) : undefined,
    })) : [];
  }
  console.error('[Shopify Storefront]', JSON.stringify({
    reason,
    status: response?.status ?? null,
    requestedApiVersion: API_VERSION,
    servedApiVersion: clean(response?.headers?.get?.('x-shopify-api-version')),
    errors: messages(result?.errors),
    userErrors: messages(result?.data?.cartCreate?.userErrors),
    warnings: messages(result?.data?.cartCreate?.warnings),
  }));
}
async function storefrontRequest(query, variables) {
  const { domain, token } = config();
  let response;
  try {
    response = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    logStorefrontFailure(null, null, 'network_failure');
    throw Object.assign(new Error('Shopify Checkout is temporarily unavailable. Please try again.'), { status: 502 });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.errors?.length) {
    logStorefrontFailure(response, result, !response.ok ? 'http_error' : !result ? 'invalid_json' : 'graphql_errors');
    throw Object.assign(new Error('Shopify Checkout could not be created. Please try again.'), { status: 502 });
  }
  const payload = result.data?.cartCreate;
  if (!payload || payload.userErrors?.length || !payload.cart?.checkoutUrl) {
    logStorefrontFailure(response, result, 'cart_create_failed');
  }
  return result.data;
}

async function createCart({ lines, email, checkoutId }) {
  const query = `mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message }
      warnings { message }
    }
  }`;
  const data = await storefrontRequest(query, {
    input: {
      lines,
      buyerIdentity: { email },
      attributes: [{ key: 'tech_hub_checkout_id', value: checkoutId }],
    },
  });
  const payload = data?.cartCreate;
  const errors = payload?.userErrors || [];
  if (errors.length || !payload?.cart?.checkoutUrl) {
    const unavailable = errors.some((error) => /merchandise|available|quantity/i.test(error.message));
    throw Object.assign(new Error(unavailable ? 'A selected product is unavailable on Shopify.' : 'Shopify Checkout could not be created.'), { status: unavailable ? 409 : 502 });
  }
  return payload.cart;
}

function verifyWebhook(rawBody, signature) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const supplied = Buffer.from(signature, 'utf8');
  const computed = Buffer.from(expected, 'utf8');
  return supplied.length === computed.length && crypto.timingSafeEqual(supplied, computed);
}

module.exports = { createCart, verifyWebhook, API_VERSION };
