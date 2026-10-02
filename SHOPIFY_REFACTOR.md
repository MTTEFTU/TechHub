# Shopify catalog refactor report

Shopify is now the authoritative catalog for the homepage, listing, product details, filtering, cart validation, COD, and hosted checkout. Tech Hub Admin reads/edits Shopify directly. Product and variant GIDs are supplied by Shopify; there are no mapping inputs or demo-product fallbacks.

## Validation

- npm test: 61 passed, 0 failed (4 frontend/cache tests and 57 backend tests including subtests).
- npx tsc --noEmit --incremental false: passed.
- npm run build: passed, including lint and build-time type checks.
- git diff --check: passed.
- Built browser assets contain no Admin authentication module, token endpoint, or Client ID/Client Secret environment references.
- Shopify/MongoDB integrations are mocked in automated tests. No live product/order mutation, payment, database migration, app authorization/release, or Vercel deployment was performed.

## Legacy MongoDB catalog

The Product and Category models are retained as legacy schemas only; live routes no longer import them. The seed script now refuses MongoDB catalog seeding. Product CRUD, local stock adjustments, local product rating writes, product population in reviews/wishlists, and manual Shopify variant mappings have been removed from runtime flows. Existing collections have not been deleted.

MongoDB still owns users/JWT authentication, reviews, wishlist references, contact messages, order references, and checkout tracking. Existing reviews/wishlists with MongoDB product IDs can be migrated with backend/scripts/migrate-product-references.js. It defaults to dry-run and uses existing mappings; unresolved references are preserved. Review its report before --apply. Legacy cart items are discarded because they lack Shopify variant GIDs.

## Required Shopify scopes

Admin app scopes: read_orders (preserved), read_products, write_products, write_orders. write_orders is used for COD orderCreate and cancellation/restocking. The app setup helper preserves any other existing scopes.

Headless Storefront permissions: unauthenticated_read_product_listings, unauthenticated_read_product_inventory, unauthenticated_read_product_tags; retain existing cart permissions. Configure these on the Headless storefront separately from the Admin app.

See [Shopify scope documentation](https://shopify.dev/docs/api/usage/access-scopes). Admin authentication now uses the [client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant), supported for a Dev Dashboard app installed on a store in the same Shopify organization. Client credentials issues a server-side/offline access token usable for COD orderCreate. There is no requirement for a permanent manually supplied token.

## Admin API authentication review

The Express-only backend/services/shopifyAdminAuth.js exchanges SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET at https://{SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token using grant_type=client_credentials. Only the issued access_token goes into X-Shopify-Access-Token. SHOPIFY_ADMIN_ACCESS_TOKEN is ignored and no longer required; remove it from local/Vercel configuration.

The provider uses expires_in from Shopify (normally 86399 seconds), renews up to 60 seconds before expiry, and shares one acquisition promise across concurrent requests in each warm process. Cold/restarted Vercel functions acquire their own token. Credential/store changes invalidate the corresponding cache. Expired tokens are never used as a fallback when acquisition fails. An explicit HTTP 401 permits one renewal and replay; ambiguous network failures, 5xx, 403, and GraphQL errors are not retried automatically, preserving COD/product mutation safety. Secrets and Shopify error bodies are never logged or forwarded.

The app must already be installed and the app/store must belong to the same Shopify organization. Switching from a static token to this grant introduces no new scopes and requires no redirect-based OAuth reauthorization. If read_products/write_products/write_orders from the catalog refactor have not yet been granted, release/approve those existing scope changes separately. Scope selection remains in the app configuration; tokens do not request extra scopes. No release, reauthorization, or deployment was performed during this authentication review.

Configure Client ID and Client Secret only on Express (the backend Vercel project). Next.js needs neither, and no Admin credentials use NEXT_PUBLIC_ variables. SHOPIFY_WEBHOOK_SECRET stays the existing app signing secret and is configured separately; raw-body HMAC behavior is preserved. Storefront API requests continue using the existing public Storefront token header.

## Environment variables and deployment

| Deployment | Required variables |
| --- | --- |
| Express backend | MONGODB_URI, JWT_SECRET, CLIENT_URL, SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_ACCESS_TOKEN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_WEBHOOK_SECRET, SHOPIFY_REVALIDATION_URL, SHOPIFY_REVALIDATION_SECRET |
| Next.js frontend | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, SHOPIFY_REVALIDATION_SECRET |

Optional: SHOPIFY_API_VERSION defaults to 2026-07; SHOPIFY_COD_COUNTRY_CODE defaults to BD; PORT is for local Express. ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD are temporary local provisioning variables only.

The revalidation secret must be identical on both deployments. Set SHOPIFY_REVALIDATION_URL to the frontend's /api/catalog/revalidate URL. The existing Storefront public token header is preserved, and all credential variables remain server-side.

Deploy/release the updated existing Shopify app configuration, approve the new installation scopes, and configure the Dev Dashboard Client ID and Client Secret on Express. Redeploy both existing Vercel projects with updated code/environments. Preserve the existing app identity, JWT authentication, payment-success/cancel pages, webhook destination, and Vercel configs.

## Automatic product visibility

Create an active Shopify product and publish it to Tech Hub Headless, associated with the configured Storefront token. The Shopify Storefront API supplies it without a MongoDB record. Verified products/create, products/update, and products/delete notifications invalidate the shared Next.js catalog tag. Cache TTL is 60 seconds as a fallback for delayed notifications/publication. Reload/navigate to fetch updated catalog data.

## Admin edits

The admin product list uses Admin GraphQL and includes drafts. Metadata saves call productUpdate; existing variant price/compare-at-price/option edits call productVariantsBulkUpdate with optionValues. Creation produces Shopify drafts, and deletion calls productDelete. Credentials never reach the browser. Publication, inventory locations, image management, and new variant dimensions remain managed in Shopify.

COD creates pending Shopify orders using fresh Storefront prices and Shopify inventory policy, with retry protection and cancellation/restocking. Hosted checkout remains Storefront cartCreate. Order/refund webhooks retain exact raw-body HMAC verification and operate on actual Shopify order lines. Existing partial-refund behavior is preserved.

## Files changed or added

- [.env.example](.env.example)
- [README.md](README.md)
- [SHOPIFY_REFACTOR.md](SHOPIFY_REFACTOR.md)
- [app/account/page.tsx](app/account/page.tsx)
- [app/admin/page.tsx](app/admin/page.tsx)
- [app/api/catalog/[id]/route.ts](app/api/catalog/[id]/route.ts)
- [app/api/catalog/revalidate/route.ts](app/api/catalog/revalidate/route.ts)
- [app/api/catalog/route.ts](app/api/catalog/route.ts)
- [app/cart/page.tsx](app/cart/page.tsx)
- [app/checkout/page.tsx](app/checkout/page.tsx)
- [app/products/[id]/page.tsx](app/products/[id]/page.tsx)
- [app/products/page.tsx](app/products/page.tsx)
- [backend/models/Category.js](backend/models/Category.js)
- [backend/models/Order.js](backend/models/Order.js)
- [backend/models/Product.js](backend/models/Product.js)
- [backend/models/Review.js](backend/models/Review.js)
- [backend/models/ShopifyCheckout.js](backend/models/ShopifyCheckout.js)
- [backend/models/User.js](backend/models/User.js)
- [backend/routes/admin.js](backend/routes/admin.js)
- [backend/routes/auth.js](backend/routes/auth.js)
- [backend/routes/categories.js](backend/routes/categories.js)
- [backend/routes/orders.js](backend/routes/orders.js)
- [backend/routes/products.js](backend/routes/products.js)
- [backend/routes/shopify.js](backend/routes/shopify.js)
- [backend/routes/shopifyWebhook.js](backend/routes/shopifyWebhook.js)
- [backend/scripts/configure-shopify-webhooks.js](backend/scripts/configure-shopify-webhooks.js)
- [backend/scripts/migrate-product-references.js](backend/scripts/migrate-product-references.js)
- [backend/scripts/seed.js](backend/scripts/seed.js)
- [backend/server.js](backend/server.js)
- [backend/services/catalog.js](backend/services/catalog.js)
- [backend/services/shopifyAdminAuth.js](backend/services/shopifyAdminAuth.js)
- [backend/tests/shopify-admin-auth.test.js](backend/tests/shopify-admin-auth.test.js)
- [backend/services/cod.js](backend/services/cod.js)
- [backend/services/shopify.js](backend/services/shopify.js)
- [backend/tests/application-data.test.js](backend/tests/application-data.test.js)
- [backend/tests/catalog.test.js](backend/tests/catalog.test.js)
- [backend/tests/fixtures.js](backend/tests/fixtures.js)
- [backend/tests/product-mapping.test.js](backend/tests/product-mapping.test.js)
- [backend/tests/shopify-flows.test.js](backend/tests/shopify-flows.test.js)
- [backend/tests/webhook-config.test.js](backend/tests/webhook-config.test.js)
- [components/ProductCard.tsx](components/ProductCard.tsx)
- [components/ProductGrid.tsx](components/ProductGrid.tsx)
- [context/CartContext.tsx](context/CartContext.tsx)
- [lib/api.ts](lib/api.ts)
- [lib/cart-state.ts](lib/cart-state.ts)
- [lib/catalog-server.ts](lib/catalog-server.ts)
- [lib/products.ts](lib/products.ts)
- [next.config.js](next.config.js)
- [package.json](package.json)
- [shopify.app.toml](shopify.app.toml)
- [shopify/README.md](shopify/README.md)
- [shopify/webhooks.toml](shopify/webhooks.toml)
- [tests/frontend.test.js](tests/frontend.test.js)
