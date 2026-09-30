import Link from 'next/link';

export default function OrderSuccessPage({ searchParams }: { searchParams: { id?: string } }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">Order received</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold text-ink">Thank you for shopping with us.</h1>
      <p className="mt-4 text-muted">Your order is confirmed for processing. You can track its status from your account.</p>
      {searchParams.id && <p className="mt-5 text-sm text-muted">Order reference: <span className="font-mono text-ink">{searchParams.id}</span></p>}
      <div className="mt-8 flex justify-center gap-3"><Link href="/account" className="rounded-full bg-primary px-6 py-3 text-sm text-white">View orders</Link><Link href="/" className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm text-ink">Continue shopping</Link></div>
    </section>
  );
}