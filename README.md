# Tech Hub

Tech Hub uses Next.js 14, Express, and MongoDB for customer accounts, authentication, reviews, wishlists, contact messages, and order references. Shopify is the only product catalog. Both COD and Shopify Checkout use Shopify variant GIDs and current Shopify prices. No MongoDB product record or manual variant mapping is required.

## Setup

Use Node.js 20 or newer and install dependencies in the repository root and backend:

```powershell
npm install
npm --prefix backend install
Copy-Item .env.example .env
```

Set the variables in [.env.example](.env.example). Never prefix Shopify credentials, webhook secrets, or revalidation secrets with NEXT_PUBLIC_. The existing public Storefront token stays server-side and uses the existing X-Shopify-Storefront-Access-Token header. A Storefront private token cannot be substituted into that variable.

Configure these Shopify permissions:

- Admin app: preserve read_orders; add read_products, write_products, and write_orders. Products and variants need read_products/write_products; COD creates unpaid Shopify orders and cancels/restocks them using write_orders.
- Headless Storefront token: unauthenticated_read_product_listings, unauthenticated_read_product_inventory, and unauthenticated_read_product_tags; retain existing cart permissions (unauthenticated_read_checkouts/unauthenticated_write_checkouts as granted).
- Tech Hub Integration is a Dev Dashboard app installed on a store in its own Shopify organization. Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET on Express. The backend uses Shopify's client credentials grant to obtain the store-scoped Admin token automatically. Tokens expire after about 24 hours; the warm-instance cache renews before expiry and shares concurrent acquisition requests. Cold Vercel instances acquire a fresh token. SHOPIFY_ADMIN_ACCESS_TOKEN is no longer read or required. Storefront tokens remain separate.
- Only the issued access token is sent as X-Shopify-Access-Token. The Client Secret is exchanged at the OAuth token endpoint and is never used directly as an Admin token. An explicit HTTP 401 triggers one reacquisition/retry; network failures, 5xx, 403, and GraphQL errors never replay mutations. Credentials/responses are not logged or returned to browsers. No refresh-token variable, callback flow, daily manual replacement, background timer, or persistent token store is required.
- Keep the existing app's webhook/client signing secret in SHOPIFY_WEBHOOK_SECRET. There is no browser-side client secret.

See [Shopify access scopes](https://shopify.dev/docs/api/usage/access-scopes), [variant mutations](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productVariantsBulkUpdate), and [COD order creation](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/orderCreate).

Run Express and Next.js in two terminals:

```powershell
npm --prefix backend run dev
npm run dev
```

Create an administrator using the existing backend admin:create script with temporary ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD variables. Public signup remains restricted to customer accounts.

## Product publishing and editing

Create an active product in Shopify, configure prices, inventory, images, options, and variants, and publish it to the Tech Hub Headless storefront associated with the configured Storefront token. It appears automatically on the homepage and product listing. Details use its Shopify handle. Unpublished products cannot be sold through Tech Hub. Category filters come from Shopify productType; the featured tag supports the featured filter.

Tech Hub Admin > Products reads the Shopify Admin GraphQL API, including drafts. Saving title, HTML description, vendor, type, and tags calls productUpdate. Saving each existing variant's price, compare-at price, and option values calls productVariantsBulkUpdate with optionValues and allowPartialUpdates: false. Variant IDs come from Shopify, with no mapping inputs. New products are created as Shopify drafts; edit their variants and publish them in Shopify. Product deletion calls productDelete.

Images, inventory location management, adding/removing variant dimensions, and publication are managed in Shopify. Categories are read-only in Tech Hub because they are derived from Shopify product types. Reviews and wishlists remain MongoDB application data keyed by Shopify product GIDs.

## Catalog and cache flow

The browser calls /api/catalog and /api/catalog/:handle on Next.js. Next fetches the Express catalog adapter, which queries Shopify Storefront GraphQL directly. MongoDB is not queried for product reads. Products, variants, and images are paginated instead of silently dropping later pages. Search matches title, description, vendor, type, and tags; price/category/availability filters and price sorting use the Shopify response.

Next.js unstable_cache caches public catalog results with the shared shopify-products tag and a 60-second revalidation fallback. Express catalog reads and all checkout validations are uncached. Review reads are separate from the product cache. Next API responses use the dynamic route behavior, so no additional route/CDN cache obscures invalidation.

The existing raw-body webhook receiver verifies exact request bytes and shop domain before handling products/create, products/update, or products/delete. It sends a server-authenticated request to SHOPIFY_REVALIDATION_URL, where Next calls revalidateTag. Failed invalidations return non-2xx to Shopify for retry. Repeated product notifications safely invalidate again. Admin edits/deletions also invalidate immediately.

A newly published product is visible on the next catalog request following invalidation; the short TTL covers delayed webhooks or publication events that don't emit a product notification. Open browser pages load again on navigation/refresh.

## Cart and checkout

Cart lines store ProductVariant GIDs and stay separate for different variants. Old MongoDB/demo-product carts are discarded. Cart prices and availability are refreshed from uncached Storefront queries on quantity changes and browser focus. The browser shows estimates; order creation never accepts browser prices, titles, paid state, or totals.

COD validates and combines variants on the server, checks availability and Storefront inventory information, calculates delivery using the existing 9-unit fee/free-at-75 rule in the shop currency, and creates an unpaid Shopify order with DECREMENT_OBEYING_POLICY. Shopify owns inventory; cancellation restocks through Shopify, with asynchronous completion acknowledged separately. MongoDB stores the resulting order reference and snapshots. COD maintains its pending payment state. The current single-country delivery form defaults to BD; set SHOPIFY_COD_COUNTRY_CODE for your shipping country.

COD requests carry an idempotency key retained across retries. A local reference is saved before Shopify is contacted. A retry returns the completed order or recovers it by its unique Shopify tag. Ambiguous network failures are not blindly retried with a new order. Definite Shopify rejections can be retried with the same reference after fresh validation. An ambiguous processing reference is visible to administrators and requires review if Shopify cannot be reconciled. No new successful order is reported on Shopify rejection.

Shopify Checkout retains Storefront cartCreate, authenticated checkout status, the tech_hub_checkout_id cart attribute, and the existing success/cancel pages. Shopify sets checkout prices. Verified orders/paid notifications use the actual paid Shopify lines, including changes made at hosted checkout, and create one local paid order using the unique Shopify order ID. No local product lookup or inventory decrement occurs. refunds/create retains the previous application behavior, which marks the local order refunded even for a partial refund.

## Existing MongoDB data

backend/models/Product.js and backend/models/Category.js are legacy models with no imports in live catalog, checkout, auth, webhook, or admin routes. The MongoDB seed command is retired. Existing product/category collections are preserved and can be archived after verifying migration; they are never catalog fallbacks.

Existing users, authentication, order history, and contact messages are retained. Existing reviews/wishlists that reference MongoDB product IDs need their references migrated to Shopify product GIDs. The migration helper uses existing product or variant mappings only; it does not copy product data into MongoDB or infer matches by title.

```powershell
node backend/scripts/migrate-product-references.js
# Review the dry-run report and back up your database before applying.
node backend/scripts/migrate-product-references.js --apply
```

The dry run reports unresolved legacy products. Unmapped legacy references remain untouched. Unique review conflicts are reported for review rather than deleted. Historic order snapshots remain intact. This task does not run a migration against your live database.

## API routes

- Public Shopify catalog: GET /api/products, GET /api/products/:handle-or-encoded-GID, GET /api/categories.
- Cart validation: POST /api/products/quote with items: [{ variantId, quantity }].
- Reviews: GET /api/products/:encoded-GID/reviews and authenticated POST to the same path.
- Admin Shopify products: GET /api/admin/products, POST /api/products, PUT/DELETE /api/products/:encoded-GID.
- Accounts/authentication, wishlists, order history, order administration, and contacts retain their existing endpoints.
- COD: authenticated POST /api/orders with items, shippingAddress, paymentMethod, and idempotencyKey.
- Shopify Checkout: authenticated POST /api/shopify/checkout and GET /api/shopify/checkout/:id/status.
- Webhooks: POST /api/shopify/webhooks, mounted before JSON parsing.
- Next public catalog: GET /api/catalog and GET /api/catalog/:handle.
- Next server-authenticated invalidation: POST /api/catalog/revalidate.

## Tests and deployment

```powershell
npm test
npx tsc --noEmit --incremental false
npm run build
```

Tests mock Shopify/MongoDB and exercise real Express HTTP routes, Shopify queries/mutations, catalog pagination/filtering, variants/prices, cart state, Next caching and secret authentication, COD, hosted checkout, and signed product/order/refund webhooks. They do not send live Shopify mutations or establish live-store connectivity.

Retain the two Vercel projects: repository root for Next.js and backend root for Express. Existing Vercel config/export behavior is preserved.

Frontend variables: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, SHOPIFY_REVALIDATION_SECRET.
Backend variables: MONGODB_URI, JWT_SECRET, CLIENT_URL, SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_ACCESS_TOKEN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_WEBHOOK_SECRET, SHOPIFY_REVALIDATION_URL, SHOPIFY_REVALIDATION_SECRET; optional SHOPIFY_API_VERSION (2026-07), SHOPIFY_COD_COUNTRY_CODE (BD), and local PORT.

Set SHOPIFY_REVALIDATION_URL to https://YOUR_FRONTEND_HOST/api/catalog/revalidate and the same secret in both projects. Redeploy both Vercel projects after code/environment changes. Deploy/release the existing Shopify app configuration, approve the newly requested scopes on the installed store, and configure its Dev Dashboard Client ID/Client Secret on Express. Changing authentication alone requires no new scopes or merchant redirect; approve previously added catalog/COD scopes if not yet granted. Configure Headless Storefront permissions separately. See [existing app deployment](shopify/README.md). Do not create a replacement app.

Before switching production, publish a test product to Tech Hub Headless and check storefront listing/details/variants, perform a controlled COD order, and complete a Shopify test payment and refund. Verify signed product webhook delivery reaches the Express backend and clears Next's cache. No live deployment, app release, authorization, or database migration was performed by the local refactor.
