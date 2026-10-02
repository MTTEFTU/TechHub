const { storefrontRequest, API_VERSION } = require('./shopify');
const { getAdminAccess, invalidateAdminToken } = require('./shopifyAdminAuth');
const { stockRejectionReason, stockRejectionMessage, logStockRejection } = require('./stockValidation');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const PRODUCT_GID = /^gid:\/\/shopify\/Product\/[0-9]+$/;
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/;
const variantFields = `id title availableForSale quantityAvailable currentlyNotInStock
  selectedOptions { name value } image { url altText }
  price { amount currencyCode } compareAtPrice { amount currencyCode }`;
const productFields = `id handle title description descriptionHtml vendor productType tags availableForSale createdAt
  options { id name values } images(first: 10) { nodes { url altText } pageInfo { hasNextPage endCursor } }
  variants(first: 10) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } }`;
function normalizeProduct(p) {
  const variants = p.variants.nodes;
  const v = variants.find(v => v.availableForSale) || variants[0];
  return { ...p, _id: p.id, name: p.title, brand: p.vendor, category: p.productType,
    images: p.images.nodes.map(i => i.url), imageData: p.images.nodes,
    variants, price: Number(v?.price.amount || 0), currencyCode: v?.price.currencyCode,
    compareAtPrice: v?.compareAtPrice ? Number(v.compareAtPrice.amount) : null,
    stock: v?.quantityAvailable, shopifyProductId: p.id, shopifyVariantId: v?.id,
    shortDescription: p.description, featured: p.tags.includes('featured') };
}
async function completeImages(p, admin = false) {
  let page = p.images;
  while (page.pageInfo?.hasNextPage) {
    const data = await (admin ? adminRequest : storefrontRequest)(`query ImagePage($id: ID!, $after: String!) {
      product: ${admin ? 'product' : 'node'}(id: $id) { ... on Product { images(first: 100, after: $after) {
        nodes { url altText } pageInfo { hasNextPage endCursor }
      } } } }`, { id: p.id, after: page.pageInfo.endCursor });
    page = data.product?.images;
    if (!page) throw fail('Shopify images could not be loaded.', 502);
    p.images.nodes.push(...page.nodes);
  }
}
async function completeProduct(p) {
  if (!p) return null;
  let page = p.variants;
  while (page.pageInfo?.hasNextPage) {
    const data = await storefrontRequest(`query VariantPage($id: ID!, $after: String!) {
      node(id: $id) { ... on Product { variants(first: 100, after: $after) {
        nodes { ${variantFields} } pageInfo { hasNextPage endCursor }
      } } }
    }`, { id: p.id, after: page.pageInfo.endCursor });
    page = data.node?.variants;
    if (!page) throw fail('Shopify variants could not be loaded.', 502);
    p.variants.nodes.push(...page.nodes);
  }
  await completeImages(p);
  return normalizeProduct(p);
}
async function listProducts(filters = {}, admin = false) {
  const products = [];
  let after = null;
  do {
    const data = await (admin ? adminRequest : storefrontRequest)(
      `query Catalog($after: String) { products(first: 20, after: $after, sortKey: CREATED_AT, reverse: true) {
        nodes { ${admin ? adminProductFields : productFields} } pageInfo { hasNextPage endCursor }
      } ${admin ? 'shop { currencyCode }' : ''} }`, { after });
    for (const p of data.products.nodes) products.push(admin ? await completeAdminProduct(p, data.shop?.currencyCode || '') : await completeProduct(p));
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  let result = products.filter(p => {
    const term = String(filters.search || '').toLowerCase();
    return (!term || [p.title, p.description, p.vendor, p.productType, ...p.tags].join(' ').toLowerCase().includes(term))
      && (!filters.category || p.category === filters.category)
      && (filters.inStock !== 'true' || p.availableForSale)
      && (filters.featured !== 'true' || p.featured)
      && (filters.minPrice === undefined || p.price >= Number(filters.minPrice))
      && (filters.maxPrice === undefined || p.price <= Number(filters.maxPrice));
  });
  if (filters.sort === 'price-asc') result.sort((a,b) => a.price-b.price);
  if (filters.sort === 'price-desc') result.sort((a,b) => b.price-a.price);
  return result;
}
async function getProduct(id) {
  const byId = PRODUCT_GID.test(id);
  if (!byId && !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(id)) throw fail('Invalid product handle or GID.');
  const data = await storefrontRequest(byId
    ? `query ProductDetail($id: ID!) { product: node(id: $id) { ... on Product { ${productFields} } } }`
    : `query ProductDetail($handle: String!) { product(handle: $handle) { ${productFields} } }`,
    byId ? { id } : { handle: id });
  return completeProduct(data.product);
}
async function validateLines(items, countryCode, source) {
  if (countryCode !== undefined) require('./checkoutCountry').validateCountryCode(countryCode);
  if (!Array.isArray(items) || !items.length || items.length > 100) throw fail('Add between 1 and 100 cart lines.');
  const quantities = new Map();
  for (const item of items) {
    if (!item || !VARIANT_GID.test(item.variantId || '') || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100)
      throw fail('Invalid Shopify variant or quantity.');
    const quantity = (quantities.get(item.variantId) || 0) + item.quantity;
    if (quantity > 100) throw fail('Maximum quantity is 100 per variant.');
    quantities.set(item.variantId, quantity);
  }
  const ids = [...quantities.keys()];
  const data = await storefrontRequest(`query CartVariants($ids: [ID!]!${countryCode ? ', $countryCode: CountryCode!' : ''}) ${countryCode ? '@inContext(country: $countryCode)' : ''} {
    nodes(ids: $ids) { ... on ProductVariant { ${variantFields}
      product { id handle title productType availableForSale } } }
  }`, { ids, ...(countryCode ? { countryCode } : {}) });
  let currency;
  return ids.map((id, index) => {
    const v = data.nodes[index];
    const quantity = quantities.get(id);
    const rejectionReason = stockRejectionReason(v, id, quantity);
    if (rejectionReason) {
      logStockRejection({ variant: v, variantId: id, quantity, countryCode, reason: rejectionReason, source });
      throw fail(stockRejectionMessage(rejectionReason), 409);
    }
    const price = Number(v.price.amount);
    if (!Number.isFinite(price) || price < 0) throw fail('Invalid Shopify price.', 502);
    if (currency && currency !== v.price.currencyCode) throw fail('Cart currencies do not match.', 409);
    currency = v.price.currencyCode;
    return { product: v.product.id, variantId: v.id, shopifyVariantId: v.id,
      handle: v.product.handle, category: v.product.productType, stock: v.currentlyNotInStock ? null : v.quantityAvailable,
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice.amount) : null,
      name: v.product.title + (v.title === 'Default Title' ? '' : ' — ' + v.title),
      image: v.image?.url || '', price, quantity, currencyCode: currency, selectedOptions: v.selectedOptions };
  });
}
async function adminRequest(query, variables) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { domain, token } = await getAdminAccess();
    let response;
    try {
      response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
      });
    } catch { throw fail('Shopify administration is temporarily unavailable.', 502); }
    if (response.status === 401) {
      invalidateAdminToken(token);
      if (attempt === 0) {
        // Only an explicit authentication rejection is replayed. Never replay a
        // mutation after an ambiguous network failure, 5xx, throttling, or userError.
        try { await response.body?.cancel?.(); } catch { /* Discard the rejected response safely. */ }
        continue;
      }
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.data || result.errors?.length)
      throw fail('Shopify administration request failed. Check app installation and token permissions.', 502);
    return result.data;
  }
}
const adminVariantFields = `id title price compareAtPrice inventoryQuantity selectedOptions { name value }`;
const adminProductFields = `id handle title description descriptionHtml vendor productType tags status
  options { id name values } images(first: 10) { nodes { url altText } pageInfo { hasNextPage endCursor } }
  variants(first: 10) { nodes { ${adminVariantFields} } pageInfo { hasNextPage endCursor } }`;
async function completeAdminProduct(p, currencyCode) {
  let page = p.variants;
  while (page.pageInfo?.hasNextPage) {
    const data = await adminRequest(`query AdminVariantPage($id: ID!, $after: String!) {
      product(id: $id) { variants(first: 100, after: $after) {
        nodes { ${adminVariantFields} } pageInfo { hasNextPage endCursor }
      } } }`, { id: p.id, after: page.pageInfo.endCursor });
    page = data.product?.variants;
    if (!page) throw fail('Shopify variants could not be loaded.', 502);
    p.variants.nodes.push(...page.nodes);
  }
  await completeImages(p, true);
  return normalizeAdmin(p, currencyCode);
}
function normalizeAdmin(p, currencyCode) {
  return normalizeProduct({ ...p, availableForSale: p.status === 'ACTIVE',
    variants: { nodes: p.variants.nodes.map(v => ({ ...v, availableForSale: p.status === 'ACTIVE',
      quantityAvailable: v.inventoryQuantity, price: { amount: v.price, currencyCode },
      compareAtPrice: v.compareAtPrice ? { amount: v.compareAtPrice, currencyCode } : null })) } });
}
function checkPayload(payload) {
  if (!payload) throw fail('Shopify returned an invalid response.', 502);
  if (payload.userErrors?.length || payload.orderCancelUserErrors?.length)
    throw fail('Shopify rejected the change. Check product options, pricing, inventory, and order status.', 409);
  return payload;
}
async function saveProduct(id, body) {
  if (id && !PRODUCT_GID.test(id)) throw fail('Invalid Shopify product GID.');
  const input = {};
  for (const field of ['title', 'descriptionHtml', 'vendor', 'productType', 'tags']) {
    if (body[field] !== undefined) input[field] = body[field];
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || !input.title.trim())) throw fail('Product title is required.');
  if (input.tags !== undefined && (!Array.isArray(input.tags) || !input.tags.every(tag => typeof tag === 'string'))) throw fail('Invalid product tags.');
  for (const field of ['descriptionHtml', 'vendor', 'productType']) if (input[field] !== undefined && typeof input[field] !== 'string') throw fail('Invalid product field.');
  if (!id && !input.title?.trim()) throw fail('Product title is required.');
  // Validate before updating the product so malformed variant edits cannot partly save.
  const variants = body.variants;
  if (variants !== undefined && (!Array.isArray(variants) || variants.length > 2048)) throw fail('Invalid variants.');
  const updates = (variants || []).map(v => {
    if (!v || !VARIANT_GID.test(v.id || '')) throw fail('Invalid Shopify variant GID.');
    const update = { id: v.id };
    for (const field of ['price', 'compareAtPrice']) {
      if (v[field] !== undefined) {
        if (field === 'compareAtPrice' && (v[field] === null || v[field] === '')) update[field] = null;
        else {
          if (!/^\d+(\.\d{1,3})?$/.test(String(v[field]))) throw fail('Enter a valid nonnegative price with at most three decimals.');
          update[field] = String(v[field]);
        }
      }
    }
    if (v.selectedOptions !== undefined) {
      if (!Array.isArray(v.selectedOptions) || !v.selectedOptions.every(o => typeof o.name === 'string' && typeof o.value === 'string' && o.value.trim()))
        throw fail('Invalid variant options.');
      update.optionValues = v.selectedOptions.map(o => ({ optionName: o.name, name: o.value }));
    }
    return update;
  });
  let product;
  try {
    const data = await adminRequest(id
      ? `mutation UpdateProduct($input: ProductUpdateInput!) { productUpdate(product: $input) { product { id } userErrors { field message } } }`
      : `mutation CreateProduct($input: ProductCreateInput!) { productCreate(product: $input) { product { id } userErrors { field message } } }`,
      { input: { ...input, ...(id ? { id } : { status: 'DRAFT' }) } });
    product = checkPayload(id ? data.productUpdate : data.productCreate).product;
    for (let offset = 0; offset < updates.length; offset += 100) {
      const data = await adminRequest(`mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: false) {
          productVariants { id } userErrors { field message }
        } }`, { productId: product.id, variants: updates.slice(offset, offset + 100) });
      checkPayload(data.productVariantsBulkUpdate);
    }
    return product;
  } finally {
    if (product) await invalidateCatalog();
  }
}
async function deleteProduct(id) {
  if (!PRODUCT_GID.test(id)) throw fail('Invalid Shopify product GID.');
  const data = await adminRequest(`mutation DeleteProduct($input: ProductDeleteInput!) {
    productDelete(input: $input) { deletedProductId userErrors { field message } } }`, { input: { id } });
  checkPayload(data.productDelete);
  await invalidateCatalog();
}
async function invalidateCatalog() {
  const url = process.env.SHOPIFY_REVALIDATION_URL;
  const secret = process.env.SHOPIFY_REVALIDATION_SECRET;
  if (!url || !secret) throw fail('Catalog revalidation is not configured.', 503);
  let response;
  try {
    response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Tech-Hub-Revalidation': secret }, body: '{}' });
  } catch { throw fail('Catalog revalidation failed. Shopify will retry the webhook.', 502); }
  if (!response.ok) throw fail('Catalog revalidation failed.', 502);
}
module.exports = { listProducts, getProduct, validateLines, adminRequest, checkPayload,
  saveProduct, deleteProduct, invalidateCatalog, PRODUCT_GID, VARIANT_GID };
