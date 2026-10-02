'use client';

import { ProductImage } from './ProductImage';
import { availabilityLabel } from '@/lib/product-presentation';
import { Product, money } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useLocale } from '@/context/LocaleContext';
import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { t } = useLocale();
  const { user, token } = useAuth();
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  async function toggleWishlist() {
    if (!user || !token) { setMessage('Sign in to save products.'); return; }
    try {
      const result = await apiRequest<{ added: boolean }>(`/auth/wishlist/${encodeURIComponent(product.id)}`, { method: 'PUT' }, token);
      setSaved(result.added);
      setMessage(result.added ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not update wishlist.'); }
  }

  return (
    <div className="hover-lift group flex h-full flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
        <ProductImage
          src={product.image}
          alt={product.name}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="h-4 truncate text-xs uppercase tracking-wide text-muted">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[3rem] font-heading text-base font-semibold leading-6 text-ink">{product.name}</h3>
        <p className="mt-1 line-clamp-3 h-[3.75rem] text-sm leading-5 text-muted">{product.blurb}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className="font-heading text-lg font-semibold text-ink">{money(product.price, product.currencyCode)}</span>
          <button
            onClick={() => addItem(product)}
            disabled={!product.availableForSale}
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {!product.availableForSale ? 'Out of stock' : t('products.addToCart')}
          </button>
        </div>
        <button onClick={toggleWishlist} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} title={saved ? 'Remove from wishlist' : 'Add to wishlist'} className="mt-3 text-sm text-primary">{saved ? '♥ Saved' : '♡ Wishlist'}</button>
        {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
        <p className="mt-2 text-xs text-muted">{availabilityLabel(product)}</p>
        <Link href={`/products/${product.handle}`} className="mt-3 inline-block text-xs text-primary hover:underline">View details</Link>
      </div>
    </div>
  );
}
