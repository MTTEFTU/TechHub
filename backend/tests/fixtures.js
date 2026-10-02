const variantId = 'gid://shopify/ProductVariant/123';
const productId = 'gid://shopify/Product/456';
function variant(overrides = {}) {
  return { id: variantId, title: 'Black', availableForSale: true, quantityAvailable: 10, currentlyNotInStock: false,
    selectedOptions: [{ name: 'Color', value: 'Black' }], image: { url: 'https://cdn.shopify.com/test.jpg', altText: 'Black phone' },
    price: { amount: '20.00', currencyCode: 'BDT' }, compareAtPrice: { amount: '25.00', currencyCode: 'BDT' },
    product: { id: productId, handle: 'test-phone', title: 'Test phone', productType: 'Phones', availableForSale: true }, ...overrides };
}
function product(overrides = {}) {
  return { id: productId, handle: 'test-phone', title: 'Test phone', description: 'A phone', descriptionHtml: '<p>A phone</p>',
    vendor: 'Test', productType: 'Phones', tags: ['featured'], availableForSale: true, createdAt: '2026-10-01',
    options: [{ id: 'gid://shopify/ProductOption/1', name: 'Color', values: ['Black'] }],
    images: { nodes: [{ url: 'https://cdn.shopify.com/test.jpg', altText: 'Phone' }] },
    variants: { nodes: [variant()], pageInfo: { hasNextPage: false, endCursor: null } }, ...overrides };
}
module.exports = { variant, product, variantId, productId };
