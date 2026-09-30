import Link from 'next/link';

export default function CheckoutCancelPage() {
  return <section className="mx-auto max-w-2xl px-6 py-24 text-center"><p className="text-sm font-medium uppercase tracking-wide text-primary">Checkout not completed</p><h1 className="mt-3 font-heading text-4xl font-semibold text-ink">Your cart is still here.</h1><p className="mt-4 text-muted">No payment has been confirmed. You can return to checkout or choose cash on delivery.</p><div className="mt-8 flex justify-center gap-3"><Link href="/checkout" className="rounded-full bg-primary px-6 py-3 text-sm text-white">Return to checkout</Link><Link href="/cart" className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm text-ink">View cart</Link></div></section>;
}
