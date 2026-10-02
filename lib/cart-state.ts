import type { Product } from './products';
export type CartItem = { product: Product; qty: number };
export function restoreCart(raw: string | null): CartItem[] {
  try {
    const items = JSON.parse(raw || '[]');
    return Array.isArray(items) ? items.filter(i => /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/.test(i?.product?.variantId)
      && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 100) : [];
  } catch { return []; }
}
export function addCartItem(items: CartItem[], product: Product): CartItem[] {
  if (!product.availableForSale || !/^gid:\/\/shopify\/ProductVariant\/[0-9]+$/.test(product.variantId)) return items;
  const limit = Math.min(100, product.stock == null ? 100 : Math.max(1, product.stock));
  const existing = items.find(i => i.product.variantId === product.variantId);
  return existing ? items.map(i => i.product.variantId === product.variantId ? { product, qty: Math.min(limit, i.qty + 1) } : i)
    : [...items, { product, qty: 1 }];
}
