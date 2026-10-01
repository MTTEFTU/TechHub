# Tech Hub

Tech Hub is an electronics storefront with a Next.js App Router frontend and an Express REST API backed by MongoDB/Mongoose. Catalog, customer accounts, orders, stock updates, contact submissions, and administrative product/order management are persisted through the API. The cart stays in browser storage until checkout. Cash on delivery remains available, and online payments use Shopify's hosted checkout through the Storefront Cart API.

## Requirements

- Node.js 18.17 or newer
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Install and configure

From the repository root:

```powershell
Copy-Item .env.example .env
npm install
Set-Location backend
npm install
Set-Location ..
```

Edit the root `.env`. Set `MONGODB_URI` to your local MongoDB URL or Atlas connection string. Replace `JWT_SECRET` with a unique random value of at least 32 characters. `CLIENT_URL` is the browser origin allowed by the API, and `NEXT_PUBLIC_API_URL` is the API base URL used by Next.js.

For Shopify checkout, set `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, and `SHOPIFY_WEBHOOK_SECRET`. `SHOPIFY_API_VERSION` defaults to the stable `2026-07` release. All Shopify variables are backend-only; never prefix tokens or secrets with `NEXT_PUBLIC_`.

## Shopify setup

1. In Shopify, create/configure a Headless storefront and issue a Storefront API access token with unauthenticated cart/product access. Keep the token on the backend.
2. Create every sellable Tech Hub item in Shopify with the correct price, inventory, shipping, and tax settings. Tech Hub never sends its browser price to Shopify.
3. In Admin Dashboard > Products, edit each MongoDB product and enter its Shopify product GID and exact variant GID, such as `gid://shopify/ProductVariant/123456789`. A product without a variant mapping remains available for COD but is rejected for online checkout.
4. Configure JSON webhooks for `orders/paid` and `refunds/create` to `https://YOUR_API_HOST/api/shopify/webhooks`. Use the same app/client secret as `SHOPIFY_WEBHOOK_SECRET`. The handler verifies the raw-body HMAC, shop domain, and delivery ID, and uses unique Shopify order IDs for idempotency.
5. Configure Shopify checkout/order-status navigation to link customers to `https://YOUR_FRONTEND_HOST/checkout/success`. Use `/checkout/cancel` as the storefront cancellation/help destination where your Shopify plan/customization supports it. The result page only reads webhook-backed backend state; it cannot mark an order paid.

Shopify is the source of truth for online price and payment. A verified `orders/paid` delivery creates the MongoDB order. The browser cart is cleared only after the backend reports that verified paid state.

For local MongoDB, install and start MongoDB Community Server, then use:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/techhub
```

For MongoDB Atlas, create a cluster, add your development IP to Network Access, create a database user, and use the cluster's `mongodb+srv://...` connection string as `MONGODB_URI`. URL-encode special characters in the database user's password.

## Seed products and create an admin

With MongoDB running and `.env` configured:

```powershell
Set-Location backend
npm run seed
$env:ADMIN_NAME="Tech Hub Admin"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="use-a-unique-password-of-12-or-more-characters"
npm run admin:create
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
Set-Location ..
```

The admin script hashes the password with bcrypt and refuses to overwrite an existing account. Public registration always creates a regular customer; admin privileges are never granted through the signup form.

## Run locally

Use two terminals from the repository root:

```powershell
# Terminal 1
Set-Location backend
npm run dev
```

```powershell
# Terminal 2
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:4000/api/health](http://localhost:4000/api/health).

## Main API routes

- `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/profile`
- `GET /api/products` supports `search`, `category`, `minPrice`, `maxPrice`, `inStock`, `featured`, and `sort` (`price-asc`, `price-desc`, `rating`, `newest`)
- `GET /api/products/:id`; admin-only `POST /api/products`, `PUT/DELETE /api/products/:id`
- `GET /api/categories`; admin-only category create/update/delete
- Authenticated `POST /api/orders` and `GET /api/orders/my-orders`; admin-only order listing and status updates
- Authenticated `POST /api/shopify/checkout` and `GET /api/shopify/checkout/:id/status`
- Shopify HMAC-verified `POST /api/shopify/webhooks`
- `POST /api/contact`; admin-only `GET /api/admin/messages`
- Admin-only `GET /api/admin/stats`, `GET/DELETE /api/admin/users/:id`

Every admin route checks a signed JWT and the database user's `admin` role. Order totals and item prices are read from MongoDB, and inventory is conditionally decremented to reject orders that exceed available stock. If order creation fails after stock was decremented, the API restores the quantities.

## Test and build

```powershell
Set-Location backend
npm test
Set-Location ..
npm run build
```

A complete checkout test requires a reachable MongoDB database, a seeded catalog, and a registered user. Verify the customer path by registering, adding a seeded product, placing a cash-on-delivery order, and checking the new order under Account. Verify the admin path by signing into the created admin account, editing a product, creating and deleting a test product, changing an order status, and confirming the catalog/order changes on the customer side. Submit the Contact form and confirm the message appears in Admin Dashboard > Messages.

For a safe Shopify test, enable Shopify Payments test mode (or the Bogus Gateway where available), map a dedicated test product/variant, expose the local backend over an HTTPS tunnel or use staging for webhooks, and place an online order with Shopify's documented test card. Confirm Shopify reports success, the webhook returns HTTP 200, Tech Hub contains exactly one paid order, and retrying the webhook does not duplicate it. Disable test mode and verify production HTTPS URLs, payment methods, mappings, webhook delivery health, tax, shipping, and refund handling before accepting live orders.

## Deployment

### Express API on Vercel

Create a separate Vercel project connected to this repository with Root Directory `backend` and Framework Preset `Other`. The backend's `vercel.json` routes requests through the Express function; do not change the frontend project's root `vercel.json`.

Use `npm install` as the install command. Leave Build Command and Output Directory empty; this backend has no build step. Vercel serves the exported Express app as a function, so `npm start` is only for local development.

Add these runtime variables under Vercel Project Settings > Environment Variables:

- `MONGODB_URI`: MongoDB Atlas connection string.
- `JWT_SECRET`: a unique, randomly generated secret of at least 32 characters.
- `CLIENT_URL`: the deployed frontend origin, with no path; comma-separated origins are supported.
- `SHOPIFY_STORE_DOMAIN`: the store's `*.myshopify.com` domain.
- `SHOPIFY_STOREFRONT_ACCESS_TOKEN`: the Storefront API token.
- `SHOPIFY_WEBHOOK_SECRET`: the Shopify app/webhook signing secret used to verify deliveries.
- `SHOPIFY_API_VERSION`: optional; defaults to `2026-07` when omitted.

The first three variables are required for the API. The Shopify variables are required for online checkout and verified webhook processing. `PORT` is for local development and is provided by the local server; it is not needed in Vercel. Configure MongoDB Atlas network access so Vercel Functions can reach the cluster without exposing the database to unrestricted access.

After deployment, test `https://YOUR_BACKEND_HOST/api/health`; it should return `{"ok":true}`. Configure Shopify JSON webhooks for `orders/paid` and `refunds/create` at `https://YOUR_BACKEND_HOST/api/shopify/webhooks`.

### Frontend and initial data

Deploy the Next.js frontend separately with its own project rooted at the repository root and the Next.js preset. Set `NEXT_PUBLIC_API_URL` to the backend origin only (for example, `https://YOUR_BACKEND_HOST`; the frontend adds `/api`) and `NEXT_PUBLIC_SITE_URL` to the frontend origin. Set the backend's `CLIENT_URL` to that same frontend origin.

Seed catalog data by running `npm run seed` from `backend/` with `MONGODB_URI` configured in a trusted local environment. Create the first administrator once with `MONGODB_URI`, `ADMIN_NAME`, `ADMIN_EMAIL`, and a temporary strong `ADMIN_PASSWORD`, then run `npm run admin:create`; remove those temporary values afterward. Do not add admin provisioning credentials to Vercel runtime settings.

Use HTTPS for both deployments. Never commit `.env`, expose backend secrets to the frontend, or place administrator credentials in client-side code.

The source retains the existing Next.js structure in this workspace rather than introducing a second React application and duplicate frontend. The API is independently runnable from `backend/`.
