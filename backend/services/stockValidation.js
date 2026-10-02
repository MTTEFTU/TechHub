const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/;

function stockRejectionReason(variant, expectedId, quantity) {
  if (!variant) return 'variant_not_returned';
  if (variant.id !== expectedId) return 'variant_id_mismatch';
  if (variant.product?.availableForSale !== true) return 'product_unavailable_in_context';
  if (variant.availableForSale !== true) return 'variant_unavailable_in_context';
  // A nullable quantity is unknown, not zero. currentlyNotInStock is Shopify's
  // explicit signal that this sold-out variant can still be purchased.
  if (Number.isInteger(variant.quantityAvailable)
    && variant.quantityAvailable < quantity && variant.currentlyNotInStock !== true) {
    return 'insufficient_sellable_quantity';
  }
  return null;
}

function stockRejectionMessage(reason) {
  const messages = {
    variant_not_returned: 'A selected variant is not available in this storefront or shipping country.',
    variant_id_mismatch: 'Shopify returned a different variant. Refresh your cart and try again.',
    product_unavailable_in_context: 'A selected product is unavailable in the selected shipping country.',
    variant_unavailable_in_context: 'A selected variant is unavailable in the selected shipping country.',
    insufficient_sellable_quantity: 'Shopify reports insufficient sellable stock for the requested quantity.',
  };
  return messages[reason] || 'A selected variant is unavailable or has insufficient stock.';
}

function logStockRejection({ variant, variantId, quantity, countryCode, reason, source }) {
  if (process.env.NODE_ENV !== 'development') return;
  console.warn('[Shopify stock validation]', JSON.stringify({
    reason,
    source: ['quote', 'checkout'].includes(source) ? source : 'validation',
    variantId: VARIANT_GID.test(variantId) ? variantId : null,
    requestedQuantity: Number.isInteger(quantity) ? quantity : null,
    countryCode: countryCode || null,
    availableForSale: typeof variant?.availableForSale === 'boolean' ? variant.availableForSale : null,
    productAvailableForSale: typeof variant?.product?.availableForSale === 'boolean' ? variant.product.availableForSale : null,
    quantityAvailable: Number.isInteger(variant?.quantityAvailable) ? variant.quantityAvailable : null,
    currentlyNotInStock: typeof variant?.currentlyNotInStock === 'boolean' ? variant.currentlyNotInStock : null,
    inventoryTracked: null,
    inventoryPolicy: null,
    inventoryMetadataSource: 'Storefront exposes currentlyNotInStock; tracking and policy are not exposed',
    userErrors: [],
    warnings: [],
    cartCreated: false,
    mutationDiagnosticsAvailable: false,
  }));
}

module.exports = { stockRejectionReason, stockRejectionMessage, logStockRejection };
