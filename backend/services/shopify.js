const crypto = require('crypto');

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';

function config() {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = (process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '').trim();
  if (!domain || !token) throw Object.assign(new Error('Online payment is not configured.'), { status: 503 });
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) throw Object.assign(new Error('Online payment configuration is invalid.'), { status: 503 });
  return { domain, token };
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
    throw Object.assign(new Error('Shopify Checkout is temporarily unavailable. Please try again.'), { status: 502 });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.errors?.length) {
    throw Object.assign(new Error('Shopify Checkout could not be created. Please try again.'), { status: 502 });
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
  const errors = data.cartCreate.userErrors || [];
  if (errors.length || !data.cartCreate.cart?.checkoutUrl) {
    const unavailable = errors.some((error) => /merchandise|available|quantity/i.test(error.message));
    throw Object.assign(new Error(unavailable ? 'A selected product is unavailable on Shopify.' : 'Shopify Checkout could not be created.'), { status: unavailable ? 409 : 502 });
  }
  return data.cartCreate.cart;
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
