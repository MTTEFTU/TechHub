import type { Product } from './products';

export const PRODUCT_PLACEHOLDER = '/product-placeholder.svg';

export function availabilityLabel(product: Pick<Product, 'availableForSale' | 'stock'>) {
  if (!product.availableForSale) return 'Out of stock';
  // Storefront does not expose inventory tracking. Zero on a sellable variant
  // can mean untracked inventory or overselling, so it is not a useful count.
  return typeof product.stock === 'number' && Number.isInteger(product.stock) && product.stock > 0
    ? `${product.stock} available`
    : 'Available';
}
