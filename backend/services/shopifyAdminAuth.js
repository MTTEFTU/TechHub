// Express-only module. Never import into Next.js/browser code.
const REFRESH_MARGIN_MS = 60_000;
const timeout = () => AbortSignal.timeout(15000);
const failure = (message, status) => Object.assign(new Error(message), { status });
function readCredentials() {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const clientId = (process.env.SHOPIFY_CLIENT_ID || '').trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET || '').trim();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain) || !clientId || !clientSecret)
    throw failure('Shopify administration is not configured. Set the store domain, Client ID, and Client Secret.', 503);
  return { domain: domain.toLowerCase(), clientId, clientSecret };
}
// A cache belongs to a single warm process and credential set. Cold Vercel instances
// acquire their own token; no durable token, background timer, or filesystem is needed.
function createAdminTokenProvider({ fetchImpl = (...args) => fetch(...args), now = Date.now, credentials = readCredentials } = {}) {
  let cache;
  async function acquire(state) {
    const startedAt = now();
    let response;
    try {
      response = await fetchImpl(`https://${state.domain}/admin/oauth/access_token`, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal: timeout(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials', client_id: state.clientId, client_secret: state.clientSecret,
        }).toString(),
      });
    } catch { throw failure('Shopify Admin authentication is temporarily unavailable.', 502); }
    // Never log, attach, or forward Shopify response bodies or credential values.
    const result = await response.json().catch(() => null);
    if (!response.ok) throw failure('Shopify Admin authentication failed. Check the app credentials, installation, and organization.', 502);
    const token = result?.access_token;
    const seconds = result?.expires_in;
    if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token) || token === state.clientSecret || token === state.clientId
      || !Number.isInteger(seconds) || seconds <= 0 || seconds > 86400)
      throw failure('Shopify Admin authentication returned an invalid token response.', 502);
    const lifetime = seconds * 1000;
    const refreshAt = startedAt + lifetime - Math.min(REFRESH_MARGIN_MS, lifetime * 0.1);
    if (now() >= refreshAt) throw failure('Shopify Admin authentication returned a token too close to expiry.', 502);
    state.token = token;
    state.refreshAt = refreshAt;
    return { domain: state.domain, token };
  }
  async function getAccess() {
    const config = credentials();
    if (!cache || cache.domain !== config.domain || cache.clientId !== config.clientId || cache.clientSecret !== config.clientSecret)
      cache = { ...config, token: null, refreshAt: 0, pending: null };
    const state = cache;
    if (state.token && now() < state.refreshAt) return { domain: state.domain, token: state.token };
    if (!state.pending) {
      state.pending = acquire(state).finally(() => { state.pending = null; });
    }
    return state.pending;
  }
  function invalidate(token) {
    // A late 401 for an old token must not discard a newer token acquired by another request.
    if (cache?.token === token) { cache.token = null; cache.refreshAt = 0; }
  }
  return { getAccess, invalidate };
}
const provider = createAdminTokenProvider();
module.exports = {
  getAdminAccess: provider.getAccess,
  invalidateAdminToken: provider.invalidate,
  createAdminTokenProvider,
};
