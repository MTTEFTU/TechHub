'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';

type AccountOrder = { _id: string; totalAmount: number; orderStatus: string; createdAt: string; products: { name: string; quantity: number }[] };
type SavedProduct = { _id: string; name: string; category: string; price: number; discountPrice?: number; images?: string[] };
export default function AccountPage() {
  const router = useRouter();
  const { user, token, ready, signOut, updateUser } = useAuth();
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [wishlist, setWishlist] = useState<SavedProduct[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !user || !token) return;
    Promise.all([apiRequest<{ orders: AccountOrder[] }>('/orders/my-orders', {}, token), apiRequest<{ products: SavedProduct[] }>('/auth/wishlist', {}, token)])
      .then(([orderResult, wishlistResult]) => { setOrders(orderResult.orders); setWishlist(wishlistResult.products); })
      .catch((reason: Error) => setError(reason.message));
  }, [ready, user, token]);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const result = await apiRequest<{ user: typeof user }>('/auth/profile', { method: 'PUT', body: JSON.stringify({ name: form.get('name'), phone: form.get('phone') }) }, token || undefined);
      if (result.user) updateUser(result.user);
      setNotice('Profile updated.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update profile.'); }
  }

  if (!ready) return <div className="mx-auto max-w-5xl px-6 py-24 text-muted">Loading account...</div>;
  if (!user) return <section className="mx-auto max-w-2xl px-6 py-24"><h1 className="text-3xl font-semibold text-ink">Sign in to view your account</h1><Link className="mt-5 inline-block text-primary" href="/login">Sign in</Link></section>;

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase text-primary">Your account</p><h1 className="mt-2 font-heading text-3xl font-semibold text-ink">Hello, {user.name}</h1><p className="mt-2 text-sm text-muted">{user.email}</p></div><button onClick={() => { signOut(); router.push('/'); }} className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-ink">Log out</button></div>
      {(error || notice) && <p role="status" className={`mt-6 text-sm ${error ? 'text-red-400' : 'text-primary'}`}>{error || notice}</p>}
      <div className="mt-10 grid gap-12 md:grid-cols-[0.8fr_1.2fr]">
        <div><h2 className="font-heading text-xl font-semibold text-ink">Profile details</h2><form onSubmit={updateProfile} className="mt-5 space-y-4"><label className="block text-sm text-muted">Full name<input name="name" defaultValue={user.name} required className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-ink" /></label><label className="block text-sm text-muted">Phone<input name="phone" defaultValue={user.phone} className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-ink" /></label><button className="rounded-full bg-primary px-5 py-2.5 text-sm text-white">Save profile</button></form></div>
        <div><h2 className="font-heading text-xl font-semibold text-ink">Order history</h2>{orders.length === 0 ? <p className="mt-4 text-sm text-muted">Your placed orders will appear here.</p> : <div className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{orders.map((order) => <article key={order._id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs text-muted">{order._id}</span><span className="text-xs uppercase text-primary">{order.orderStatus}</span></div><p className="mt-2 text-sm text-ink">{order.products.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</p><div className="mt-2 flex justify-between text-xs text-muted"><span>{new Date(order.createdAt).toLocaleDateString()}</span><span>${order.totalAmount.toFixed(2)}</span></div></article>)}</div>}
          <h2 className="mt-10 font-heading text-xl font-semibold text-ink">Wishlist</h2>{wishlist.length ? <div className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{wishlist.map((product) => <Link key={product._id} href={`/products/${product._id}`} className="flex justify-between gap-3 py-4 text-sm"><span className="text-ink">{product.name}<span className="block text-xs text-muted">{product.category}</span></span><span className="text-ink">${product.discountPrice ?? product.price}</span></Link>)}</div> : <p className="mt-3 text-sm text-muted">Saved products will appear here.</p>}
        </div>
      </div>
    </section>
  );
}