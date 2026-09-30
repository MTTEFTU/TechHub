'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

type CheckoutState = { id: string; status: 'pending' | 'paid' | 'failed' | 'expired'; orderId?: string; shopifyOrderName?: string };

export default function ShopifyCheckoutSuccessPage() {
  const { token, ready } = useAuth();
  const { clear } = useCart();
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [message, setMessage] = useState('Checking your payment status...');

  useEffect(() => {
    if (!ready || !token) return;
    const id = sessionStorage.getItem('tech-hub-shopify-checkout');
    if (!id) { setMessage('We could not identify this checkout. View your account for the latest order status.'); return; }
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      try {
        const result = await apiRequest<{ checkout: CheckoutState }>(`/shopify/checkout/${id}/status`, {}, token);
        if (cancelled) return;
        setCheckout(result.checkout);
        if (result.checkout.status === 'paid') {
          clear();
          sessionStorage.removeItem('tech-hub-shopify-checkout');
          setMessage('Payment confirmed. Your order is ready for processing.');
          return;
        }
        attempts += 1;
        setMessage(attempts < 10 ? 'Payment confirmation is still processing. This page will update automatically.' : 'Payment is not confirmed yet. Check your account again shortly.');
        if (attempts < 10) window.setTimeout(check, 3000);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not check payment status.'); }
    };
    check();
    return () => { cancelled = true; };
  }, [ready, token, clear]);

  return <section className="mx-auto max-w-2xl px-6 py-24 text-center"><p className="text-sm font-medium uppercase tracking-wide text-primary">Shopify checkout</p><h1 className="mt-3 font-heading text-4xl font-semibold text-ink">{checkout?.status === 'paid' ? 'Payment confirmed' : 'Confirming payment'}</h1><p className="mt-4 text-muted">{message}</p>{checkout?.shopifyOrderName && <p className="mt-5 text-sm text-muted">Shopify reference: <span className="font-mono text-ink">{checkout.shopifyOrderName}</span></p>}<div className="mt-8 flex justify-center gap-3"><Link href="/account" className="rounded-full bg-primary px-6 py-3 text-sm text-white">View orders</Link><Link href="/" className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm text-ink">Continue shopping</Link></div></section>;
}
