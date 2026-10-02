'use client';

import { ProductDescription } from '@/components/ProductDescription';
import { ProductImage } from '@/components/ProductImage';
import { availabilityLabel } from '@/lib/product-presentation';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ApiProduct } from '@/lib/api';
import { toProduct, money } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';

type Detail = { product: ApiProduct; related: ApiProduct[]; reviews: { _id: string; rating: number; comment: string; user?: { name: string } }[] };
export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const { user, token } = useAuth();
  const [variantId, setVariantId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    fetch(`/api/catalog/${encodeURIComponent(params.id)}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Product could not be loaded.');
      setDetail(body);
      setVariantId(body.product.shopifyVariantId);
      apiRequest<{ reviews: Detail['reviews'] }>(`/products/${encodeURIComponent(body.product._id)}/reviews`)
        .then(result => setDetail(current => current ? { ...current, reviews: result.reviews } : current))
        .catch(() => setReviewMessage('Reviews could not be loaded.'));
    }).catch((reason: Error) => setError(reason.message));
  }, [params.id]);

  if (error) return <section className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-2xl font-semibold text-ink">Product unavailable</h1><p className="mt-3 text-muted">{error}</p><Link href="/#products" className="mt-5 inline-block text-primary">Back to products</Link></section>;
  if (!detail) return <div className="mx-auto max-w-6xl px-6 py-24 text-muted">Loading product...</div>;

  const { product } = detail;
  const selectedVariant = product.variants.find(v => v.id === variantId);
  const cartProduct = toProduct(product, selectedVariant);
  const specifications = Object.entries((product as ApiProduct & { specifications?: Record<string, string> }).specifications || {})
    .filter(([key, value]) => key.trim() && typeof value === 'string' && value.trim());
  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await apiRequest<{ review: Detail['reviews'][number] }>(`/products/${encodeURIComponent(product._id)}/reviews`, { method: 'POST', body: JSON.stringify({ rating: Number(values.rating), comment: values.comment }) }, token || undefined);
      setDetail((current) => current ? { ...current, reviews: [...current.reviews, { ...result.review, user: { name: user?.name || 'Customer' } }] } : current);
      setReviewMessage('Thanks. Your review has been added.');
      form.reset();
    } catch (reason) { setReviewMessage(reason instanceof Error ? reason.message : 'Review could not be submitted.'); }
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="grid items-start gap-8 md:grid-cols-2 lg:gap-12">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-[var(--color-surface)]"><ProductImage src={cartProduct.image} alt={product.name} sizes="(min-width: 768px) 50vw, 100vw" /></div>
        <div className="min-w-0">
          <p className="text-sm uppercase text-muted">{product.brand} · {product.category}</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold text-ink">{product.name}</h1>
          <p className="mt-4 text-sm text-muted">★ {product.rating || 'New'} · {availabilityLabel(cartProduct)}</p>
          <p className="mt-6 text-2xl font-semibold text-ink">{money(cartProduct.price, cartProduct.currencyCode)} {cartProduct.compareAtPrice && <span className="ml-2 text-base text-muted line-through">{money(cartProduct.compareAtPrice, cartProduct.currencyCode)}</span>}</p>
          <ProductDescription key={product._id} description={product.description || product.shortDescription || ''} />
          <label className="mt-5 block text-sm text-muted">Choose variant<select aria-label="Choose variant" className="mt-2 block rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-3" value={variantId} onChange={event => setVariantId(event.target.value)}>{product.variants.map(v => <option key={v.id} value={v.id}>{v.selectedOptions.map(o => `${o.name}: ${o.value}`).join(' / ')}{v.availableForSale ? '' : ' (unavailable)'}</option>)}</select></label>
          <div className="mt-7 flex flex-wrap gap-3"><button disabled={!cartProduct.availableForSale} onClick={() => addItem(cartProduct)} className="rounded-full bg-primary px-7 py-3 text-sm font-medium text-white disabled:opacity-50">Add to cart</button><button disabled={!cartProduct.availableForSale} onClick={() => { addItem(cartProduct); router.push('/checkout'); }} className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-medium text-ink disabled:opacity-50">Buy now</button></div>
          {specifications.length > 0 && <div className="mt-9 border-t border-[var(--color-border)] pt-6"><h2 className="font-semibold text-ink">Specifications</h2><dl className="mt-3 space-y-2 text-sm text-muted">{specifications.map(([key, value]) => <div key={key} className="flex justify-between gap-4"><dt>{key}</dt><dd className="text-right text-ink">{value}</dd></div>)}</dl></div>}
        </div>
      </div>
      <section className="mt-16"><h2 className="font-heading text-2xl font-semibold text-ink">Customer reviews</h2>{detail.reviews.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2">{detail.reviews.map((review) => <article key={review._id} className="border-t border-[var(--color-border)] py-4"><p className="text-primary">{'★'.repeat(review.rating)}</p><p className="mt-2 text-sm text-muted">{review.comment}</p><p className="mt-2 text-xs text-ink">{review.user?.name || 'Customer'}</p></article>)}</div> : <p className="mt-4 text-sm text-muted">No reviews yet.</p>}
        {user ? <form onSubmit={submitReview} className="mt-8 max-w-xl space-y-3 border-t border-[var(--color-border)] pt-6"><h3 className="font-semibold text-ink">Write a review</h3><select name="rating" required defaultValue="5" className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-ink"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select><textarea name="comment" rows={3} maxLength={2000} placeholder="Your experience" className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-ink" /><button className="rounded-full bg-primary px-5 py-2.5 text-sm text-white">Submit review</button>{reviewMessage && <p role="status" className="text-sm text-muted">{reviewMessage}</p>}</form> : <p className="mt-6 text-sm text-muted"><Link href="/login" className="text-primary">Sign in</Link> to write a review.</p>}
      </section>
    </div>
  );
}