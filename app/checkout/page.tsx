'use client';

import Link from 'next/link';
import { CheckoutCountrySelect } from '@/components/CheckoutCountrySelect';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { money } from '@/lib/products';
import { apiRequest } from '@/lib/api';

type ShippingValues = { fullName: string; phone: string; email: string; address: string; city: string; postalCode: string; countryCode?: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { items, subtotal, clear, validating, validationError, setCountryCode } = useCart();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'shopify'>('cash_on_delivery');
  const [shippingCountry, setShippingCountry] = useState('');
  useEffect(() => {
    setCountryCode(paymentMethod === 'shopify' && shippingCountry ? shippingCountry : undefined);
  }, [paymentMethod, shippingCountry, setCountryCode]);
  useEffect(() => () => setCountryCode(undefined), [setCountryCode]);
  const currencyCode = items[0]?.product.currencyCode || '';
  const shipping = subtotal >= 75 || subtotal === 0 ? 0 : 9;

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validating || validationError) { setError(validationError || 'Please wait while cart prices are checked.'); return; }
    setBusy(true);
    setError('');
    const address = Object.fromEntries(new FormData(event.currentTarget).entries()) as ShippingValues;
    try {
      const orderItems = items.map(({ product, qty }) => ({ variantId: product.variantId, quantity: qty }));
      if (paymentMethod === 'cash_on_delivery') {
        const idempotencyKey = sessionStorage.getItem('tech-hub-cod-request') || crypto.randomUUID();
        sessionStorage.setItem('tech-hub-cod-request', idempotencyKey);
        const result = await apiRequest<{ order: { _id: string } }>('/orders', { method: 'POST', body: JSON.stringify({ items: orderItems, shippingAddress: address, paymentMethod, idempotencyKey }) }, token || undefined);
        sessionStorage.removeItem('tech-hub-cod-request');
        clear();
        router.push(`/order-success?id=${result.order._id}`);
      } else {
        const result = await apiRequest<{ checkoutId: string; checkoutUrl: string }>('/shopify/checkout', { method: 'POST', body: JSON.stringify({ items: orderItems, shippingAddress: address }) }, token || undefined);
        sessionStorage.setItem('tech-hub-shopify-checkout', result.checkoutId);
        window.location.assign(result.checkoutUrl);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Order could not be placed.');
    } finally { setBusy(false); }
  }

  if (items.length === 0) return <section className="mx-auto max-w-3xl px-6 py-20"><h1 className="text-3xl font-semibold text-ink">Your cart is empty</h1><Link href="/#products" className="mt-5 inline-block text-primary">Continue shopping</Link></section>;
  if (!user) return <section className="mx-auto max-w-xl px-6 py-20"><h1 className="text-3xl font-semibold text-ink">Sign in to check out</h1><p className="mt-3 text-muted">Your order history and delivery updates are saved to your account.</p><Link href="/login?next=/checkout" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm text-white">Sign in</Link></section>;

  const inputClass = 'w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-primary';
  return (
    <section className="mx-auto grid max-w-5xl gap-12 px-6 py-16 md:grid-cols-[1.2fr_0.8fr]">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-ink">Delivery details</h1>
        {(error || validationError) && <p role="alert" className="mt-5 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error || validationError}</p>}
        <form onSubmit={placeOrder} className="mt-7 grid gap-4 sm:grid-cols-2">
          <input name="fullName" autoComplete="name" defaultValue={user.name} className={`${inputClass} sm:col-span-2`} placeholder="Full name" required />
          <input name="phone" autoComplete="tel" defaultValue={user.phone} className={inputClass} placeholder="Phone number" required />
          <input name="email" type="email" autoComplete="email" defaultValue={user.email} className={inputClass} placeholder="Email" required />
          <input name="address" autoComplete="street-address" className={`${inputClass} sm:col-span-2`} placeholder="Street address" required />
          <input name="city" autoComplete="address-level2" className={inputClass} placeholder="City" required />
          <input name="postalCode" autoComplete="postal-code" className={inputClass} placeholder="Postal code" required />
          {paymentMethod === 'shopify' && <CheckoutCountrySelect className={inputClass} value={shippingCountry} onChange={setShippingCountry} />}
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink">Payment method</legend>
            <div className="space-y-3">
              <label className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-4 text-sm text-ink"><input type="radio" name="paymentChoice" checked={paymentMethod === 'cash_on_delivery'} onChange={() => setPaymentMethod('cash_on_delivery')} /> Cash on delivery</label>
              <label className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-4 text-sm text-ink"><input type="radio" name="paymentChoice" checked={paymentMethod === 'shopify'} onChange={() => setPaymentMethod('shopify')} /> Online Payment (Shopify Secure Checkout)</label>
            </div>
          </fieldset>
          <button disabled={busy || validating || !!validationError} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2">{busy ? (paymentMethod === 'shopify' ? 'Opening secure checkout...' : 'Placing order...') : (paymentMethod === 'shopify' ? 'Continue to Shopify Checkout' : 'Place order')}</button>
        </form>
      </div>
      <aside className="h-fit border-y border-[var(--color-border)] py-5">
        <h2 className="font-heading text-lg font-semibold text-ink">Order summary</h2>
        <div className="mt-5 divide-y divide-[var(--color-border)]">
          {items.map(({ product, qty }) => <div key={product.variantId} className="flex justify-between gap-4 py-3 text-sm"><span className="text-muted">{product.name} × {qty}</span><span className="text-ink">{money(product.price * qty, product.currencyCode)}</span></div>)}
        </div>
        <div className="mt-4 flex justify-between text-sm text-muted"><span>Subtotal</span><span>{money(subtotal, currencyCode)}</span></div>
        <div className="mt-2 flex justify-between text-sm text-muted"><span>Delivery</span><span>{shipping ? money(shipping, currencyCode) : 'Free'}</span></div>
        <div className="mt-4 flex justify-between border-t border-[var(--color-border)] pt-4 font-semibold text-ink"><span>Total</span><span>{money(subtotal + shipping, currencyCode)}</span></div>
      </aside>
    </section>
  );
}
