import type { ApiProduct, ApiVariant } from './api';
export type Product = {
  id: string; handle: string; variantId: string; name: string; category: string;
  price: number; compareAtPrice?: number | null; currencyCode: string; image: string;
  blurb: string; stock?: number | null; rating?: number; availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
};
export function toProduct(product: ApiProduct, selected?: ApiVariant): Product {
  const variant = selected || product.variants.find(v => v.availableForSale) || product.variants[0];
  return { id: product._id, handle: product.handle, variantId: variant?.id || '',
    name: product.title + (variant && variant.title !== 'Default Title' ? ' ? ' + variant.title : ''),
    category: product.productType, price: Number(variant?.price.amount || 0),
    compareAtPrice: variant?.compareAtPrice ? Number(variant.compareAtPrice.amount) : null,
    currencyCode: variant?.price.currencyCode || product.currencyCode || '',
    image: variant?.image?.url || product.images?.[0] || '/product-placeholder.svg',
    blurb: product.description || '', stock: variant?.currentlyNotInStock ? null : variant?.quantityAvailable,
    availableForSale: !!variant?.availableForSale, selectedOptions: variant?.selectedOptions || [] };
}
export function money(amount: number, currencyCode: string) {
  return currencyCode ? new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount) : amount.toFixed(2);
}
