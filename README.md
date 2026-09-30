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

1. Create a MongoDB Atlas database and configure network access for your API host.
2. Deploy `backend/` as a Node service (for example, Render). Use `npm install` as the install command and `npm start` as the start command. Configure `MONGODB_URI`, a strong `JWT_SECRET`, `PORT` if required by the host, and `CLIENT_URL` with the deployed frontend origin. Deploy the API and seed products using `npm run seed` from the backend service shell.
3. Set `NEXT_PUBLIC_API_URL` to the deployed API origin plus `/api` and `NEXT_PUBLIC_SITE_URL` to the deployed frontend origin, then deploy the repository as a Next.js app (for example, Vercel). Update the API's `CLIENT_URL` to that exact frontend origin and redeploy the API.
4. Create the first administrator once using the backend shell with `ADMIN_NAME`, `ADMIN_EMAIL`, and a temporary strong `ADMIN_PASSWORD`, then run `npm run admin:create`. Remove the temporary variables after creation.
5. Use HTTPS for both deployed services. Never commit `.env`, expose `JWT_SECRET` to the frontend, or place administrator credentials in client-side code.

The source retains the existing Next.js structure in this workspace rather than introducing a second React application and duplicate frontend. The API is independently runnable from `backend/`.
