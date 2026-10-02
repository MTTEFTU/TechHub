# Existing Tech Hub Integration app

Use the existing app and keep its public client_id and installation settings. Do not create another app.

```powershell
shopify app config link
node backend/scripts/configure-shopify-webhooks.js
git diff -- shopify.app.toml
shopify app deploy
```

Choose the EXISTING Tech Hub Integration app when linking. The helper preserves all downloaded scopes/settings and adds read_products, write_products, write_orders, and the existing read_orders. It preserves the configured webhook API version and adds these full-payload subscriptions:

- orders/paid
- refunds/create
- products/create
- products/update
- products/delete

Verify the subscription URI points to your Express backend's /api/shopify/webhooks. The committed URI preserves the existing deployment. The Next frontend's /api/catalog/revalidate is an internal invalidation endpoint, not a Shopify webhook receiver.

Release the updated app configuration and approve the new scopes on the installed store. For this Dev Dashboard app and store in the same organization, configure SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET on Express. The backend exchanges them with grant_type=client_credentials at the store's /admin/oauth/access_token endpoint. It caches the issued token per warm instance and reacquires it before its roughly 24-hour expiry; no SHOPIFY_ADMIN_ACCESS_TOKEN is required. Client credentials tokens support server-side Admin calls, including COD. Switching the grant alone needs no new permissions or redirect authorization flow; ensure the app is installed and approve the existing catalog/COD scope changes if still pending. Preserve the existing app signing/client secret as SHOPIFY_WEBHOOK_SECRET. Keep Admin credentials, webhook secrets, and revalidation secrets server-side.

Headless Storefront permissions are separate: enable product listings, inventory, and tags; retain existing cart permissions. Publish active products to the storefront associated with the configured public Storefront token. No Tech Hub mapping is needed.

Deploy Express and Next.js on their existing Vercel projects. Set SHOPIFY_REVALIDATION_URL to the Next.js /api/catalog/revalidate URL, and set the identical SHOPIFY_REVALIDATION_SECRET on both deployments. Redeploy after changing environments. The app CLI deploy releases Shopify configuration; it does not deploy Vercel code.

Validate all five webhook topics in the existing app's delivery logs. A product notification must return 200 Revalidated. Failed cache invalidation returns non-2xx so Shopify retries. Order callbacks preserve exact raw-body verification and use actual Shopify lines/prices. The local database never decrements product stock.

Run npm test in the repository root. Automated tests use mocked Shopify/MongoDB and do not create live products/orders. Perform live testing only with a controlled test product and Shopify payment test mode. Existing refunds/create semantics mark a whole order refunded, including partial refunds.

References:
- [CLI config link](https://shopify.dev/docs/api/shopify-cli/app/app-config-link)
- [Access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Webhook troubleshooting](https://shopify.dev/docs/apps/build/webhooks/troubleshoot)
