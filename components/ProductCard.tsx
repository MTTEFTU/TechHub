'use client';

import Image from 'next/image';
import { Product } from '@/lib/products';
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
      const result = await apiRequest<{ added: boolean }>(`/auth/wishlist/${product.id}`, { method: 'PUT' }, token);
      setSaved(result.added);
      setMessage(result.added ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not update wishlist.'); }
  }

  return (
    <div className="hover-lift group overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted">{product.category}</p>
        <h3 className="mt-1 font-heading text-base font-semibold text-ink">{product.name}</h3>
        <p className="mt-1 text-sm text-muted">{product.blurb}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="font-heading text-lg font-semibold text-ink">${product.price}</span>
          <button
            onClick={() => addItem(product)}
            disabled={product.stock === 0}
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {product.stock === 0 ? 'Out of stock' : t('products.addToCart')}
          </button>
        </div>
        {product.stock !== undefined && <button onClick={toggleWishlist} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} title={saved ? 'Remove from wishlist' : 'Add to wishlist'} className="mt-3 text-sm text-primary">{saved ? '♥ Saved' : '♡ Wishlist'}</button>}
        {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
        {product.stock !== undefined && <p className="mt-2 text-xs text-muted">{product.stock > 0 ? `${product.stock} in stock` : 'Currently unavailable'}</p>}
        <Link href={`/products/${product.id}`} className="mt-3 inline-block text-xs text-primary hover:underline">View details</Link>
      </div>
    </div>
  );
}
