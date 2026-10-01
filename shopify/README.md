# Existing Tech Hub Integration app webhooks

Shopify supports importing an existing Dev Dashboard app with CLI:
https://shopify.dev/docs/apps/build/cli-for-apps/migrate-from-dashboard
https://shopify.dev/docs/api/shopify-cli/app/app-config-link

Do not run app init or create another app. From the repository root:

    npm install -g @shopify/cli@latest
    shopify app config link
    node backend/scripts/configure-shopify-webhooks.js
    git diff -- shopify.app.toml
    shopify app deploy

During config link, choose the EXISTING Tech Hub Integration app and save its downloaded
configuration as shopify.app.toml. Verify its client_id against that app's public Client ID.
This preserves its existing name, URLs, install settings, scopes and any other subscriptions.
The helper adds exactly the subscriptions in webhooks.toml and preserves an existing webhook
API version (2026-07 for a configuration with no version). If existing target subscriptions
are detected, it stops instead of overwriting them. Review and consolidate those entries first.
Do not add filters or include_fields: the receiver needs the full payload and checkout attributes.
Keep read_orders and all other existing scopes. No Admin API token or OAuth code is needed.

Deploy creates and releases a new version of the SAME app; it does not deploy Express to Vercel.
No reinstall/re-authorization is needed for webhook-only changes with read_orders already granted.
If the app has extensions managed elsewhere, review the deploy preview so they are preserved.
CLI config link downloads real app identity; this repository deliberately does not invent it.

Both ORDERS_PAID (orders/paid) and REFUNDS_CREATE (refunds/create) deliver JSON to:
https://tech-hub-ivory-phi.vercel.app/api/shopify/webhooks

Vercel backend environment: MONGODB_URI, JWT_SECRET, CLIENT_URL, SHOPIFY_STORE_DOMAIN,
SHOPIFY_STOREFRONT_ACCESS_TOKEN, SHOPIFY_WEBHOOK_SECRET, optional SHOPIFY_API_VERSION
(default 2026-07). SHOPIFY_WEBHOOK_SECRET must be this app's client secret for app-specific
deliveries. A store-admin-created webhook signing secret is different. Keep all values private.
Redeploy Vercel after environment changes. Existing raw-body middleware and HMAC stay intact.

Run npm test from backend. Tests use mocked database/Storefront operations and local HTTP:
they do not place live orders or prove live MongoDB/Shopify/Vercel connectivity.

Safe end-to-end test: use a development/test store or a controlled payment test window,
a dedicated mapped variant, and Shopify Payments test mode/Bogus Gateway. Start checkout
through Tech Hub so the cart carries tech_hub_checkout_id. Before payment, local checkout
must be pending. Complete the test payment and confirm exactly one local paid order and
one stock decrement. Refund that test order and confirm refunded status. Replay the paid
delivery and confirm no duplicate order or stock decrement. Synthetic CLI payloads lack
the local checkout mapping and may correctly return Ignored; they don't test subscriptions.
Current duplicate protection covers immediate duplicate IDs; order lookup also prevents
sequential paid replays from creating another order. Concurrent deliveries and partial
database failures are not transactionally protected by this existing handler.

In Dev Dashboard > Tech Hub Integration > Logs, filter webhook deliveries for each topic.
Inspect the destination URL, response code (200), delivery attempts, timestamp and webhook ID.
Correlate the delivery with the local order; 200 Ignored alone does not prove order processing.
Troubleshooting: https://shopify.dev/docs/apps/build/webhooks/troubleshoot
refunds/create indicates a refund was created, independently of money movement; this project's
existing behavior marks the entire local order refunded, including partial refunds.

After reviewing changes (never add .env):

    git add README.md shopify/webhooks.toml shopify/README.md backend/scripts/configure-shopify-webhooks.js backend/tests/shopify-flows.test.js
    git commit -m "Configure existing Shopify app webhooks and test checkout flows"
    git push origin main

After CLI linking/configuration, also commit the public configuration:

    git add shopify.app.toml
    git commit -m "Link Tech Hub Integration Shopify app configuration"
    git push origin main
