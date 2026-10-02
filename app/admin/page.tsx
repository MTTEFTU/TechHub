'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { money } from '@/lib/products';
import { ApiProduct, apiRequest } from '@/lib/api';

type Stats = { totalProducts: number; totalUsers: number; totalOrders: number; pendingOrders: number; completedOrders: number; lowStockProducts: number; totalSales: number };
type AdminOrder = { currencyCode: string; creationStatus?: string; _id: string; totalAmount: number; orderStatus: string; paymentMethod: string; paymentStatus: string; shopifyOrderName?: string; createdAt: string; products: { name: string; quantity: number }[]; user?: { name: string; email: string } };
type AdminUser = { _id: string; name: string; email: string; role: string; createdAt: string };
type Category = { _id: string; name: string; image: string };
type Message = { _id: string; name: string; email: string; subject: string; message: string; createdAt: string };
type AdminReview = { _id: string; rating: number; comment: string; user?: { name: string }; product?: { name: string }; createdAt: string };
type Panel = 'dashboard' | 'products' | 'categories' | 'orders' | 'users' | 'reviews' | 'messages';
const panels: { id: Panel; label: string }[] = [{ id: 'dashboard', label: 'Dashboard' }, { id: 'products', label: 'Products' }, { id: 'categories', label: 'Categories' }, { id: 'orders', label: 'Orders' }, { id: 'users', label: 'Customers' }, { id: 'reviews', label: 'Reviews' }, { id: 'messages', label: 'Messages' }];
const fieldClass = 'w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-sm text-ink outline-none focus:border-primary';

export default function AdminPage() {
  const { user, token, ready } = useAuth();
  const [panel, setPanel] = useState<Panel>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    const load = async () => {
      try {
        setError('');
        if (panel === 'dashboard') setStats((await apiRequest<{ stats: Stats }>('/admin/stats', {}, token)).stats);
        if (panel === 'products') setProducts((await apiRequest<{ products: ApiProduct[] }>('/admin/products', {}, token)).products);
        if (panel === 'orders') setOrders((await apiRequest<{ orders: AdminOrder[] }>('/orders', {}, token)).orders);
        if (panel === 'users') setUsers((await apiRequest<{ users: AdminUser[] }>('/admin/users', {}, token)).users);
        if (panel === 'categories') setCategories((await apiRequest<{ categories: Category[] }>('/categories', {}, token)).categories);
        if (panel === 'messages') setMessages((await apiRequest<{ messages: Message[] }>('/admin/messages', {}, token)).messages);
        if (panel === 'reviews') setReviews((await apiRequest<{ reviews: AdminReview[] }>('/admin/reviews', {}, token)).reviews);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load this section.'); }
    };
    load();
  }, [panel, refresh, token, user]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = {
      title: values.name, vendor: values.brand, productType: values.category,
      descriptionHtml: values.descriptionHtml,
      tags: String(values.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
      ...(editing ? { variants: editing.variants.map((variant, index) => ({
        id: variant.id, price: String(values['price-' + index]),
        compareAtPrice: values['compare-' + index] || null,
        selectedOptions: variant.selectedOptions.map((option, optionIndex) => ({
          name: option.name, value: String(values['option-' + index + '-' + optionIndex]),
        })),
      })) } : {}),
    };
    try {
      await apiRequest(editing ? `/products/${encodeURIComponent(editing._id)}` : '/products', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) }, token || undefined);
      setEditing(null); setNotice(editing ? 'Shopify product updated.' : 'Draft created in Shopify. Publish it to Tech Hub Headless to show it in the store.'); setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Product could not be saved.'); }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm('Delete this product?')) return;
    try { await apiRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }, token || undefined); setNotice('Product deleted.'); setRefresh((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Product could not be deleted.'); }
  }

  async function setOrderStatus(id: string, orderStatus: string) {
    try { await apiRequest(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ orderStatus }) }, token || undefined); setNotice('Order update submitted. Refresh to check its status.'); setRefresh((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Order could not be updated.'); }
  }

  async function removeReview(id: string) {
    try { await apiRequest(`/admin/reviews/${id}`, { method: 'DELETE' }, token || undefined); setRefresh((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Review could not be removed.'); }
  }

  if (!ready) return <div className="px-6 py-24 text-center text-muted">Loading admin access...</div>;
  if (!user || user.role !== 'admin') return <section className="mx-auto max-w-2xl px-6 py-24"><h1 className="font-heading text-3xl font-semibold text-ink">Administrator access required</h1><p className="mt-3 text-muted">Sign in with an administrator account to continue.</p><Link href="/login" className="mt-5 inline-block text-primary">Sign in</Link></section>;

  const statItems: [string, number | string][] = stats ? [['Products', stats.totalProducts], ['Customers', stats.totalUsers], ['Orders', stats.totalOrders], ['Sales', `$${stats.totalSales.toFixed(2)}`], ['Pending', stats.pendingOrders], ['Delivered', stats.completedOrders], ['Low stock', stats.lowStockProducts]] : [];
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase text-primary">Tech Hub operations</p><h1 className="mt-2 font-heading text-3xl font-semibold text-ink">Admin dashboard</h1></div><Link href="/" className="text-sm text-muted hover:text-primary">View store</Link></div>
      <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-[var(--color-border)] pb-3">{panels.map((item) => <button key={item.id} onClick={() => { setPanel(item.id); setEditing(null); setError(''); setNotice(''); }} className={`shrink-0 rounded-md px-3 py-2 text-sm ${panel === item.id ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>{item.label}</button>)}</nav>
      {(error || notice) && <p role="status" className={`mt-5 text-sm ${error ? 'text-red-400' : 'text-primary'}`}>{error || notice}</p>}
      {panel === 'dashboard' && <div className="mt-7 grid gap-px overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4">{statItems.map(([label, value]) => <div key={label} className="bg-[var(--color-background)] p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 font-heading text-2xl font-semibold text-ink">{value}</p></div>)}</div>}
      {panel === 'products' && <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(280px,0.8fr)_1.2fr]">
        <form key={editing?._id || 'new-product'} onSubmit={saveProduct} className="h-fit space-y-3 border-y border-[var(--color-border)] py-5"><h2 className="font-heading text-xl font-semibold text-ink">{editing ? 'Edit product' : 'Add product'}</h2>
          <input name="name" required defaultValue={editing?.name} placeholder="Product name" className={fieldClass} /><input name="brand" defaultValue={editing?.brand} placeholder="Brand" className={fieldClass} /><input name="category" required defaultValue={editing?.category} placeholder="Category" className={fieldClass} />
          <textarea name="descriptionHtml" rows={4} defaultValue={editing?.descriptionHtml} placeholder="Description (HTML supported)" className={fieldClass} />
          <input name="tags" defaultValue={editing?.tags.join(', ')} placeholder="Tags, comma separated (use featured for featured products)" className={fieldClass} />
          {editing?.variants.map((variant, index) => <fieldset key={variant.id} className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <legend className="text-sm text-ink">{variant.title}</legend>
            <label className="block text-sm text-muted">Price<input name={`price-${index}`} type="number" min="0" step="0.001" required defaultValue={variant.price.amount} className={fieldClass} /></label>
            <label className="block text-sm text-muted">Compare-at price<input name={`compare-${index}`} type="number" min="0" step="0.001" defaultValue={variant.compareAtPrice?.amount || ''} className={fieldClass} /></label>
            {variant.selectedOptions.map((option, optionIndex) => <label key={option.name} className="block text-sm text-muted">{option.name}<input name={`option-${index}-${optionIndex}`} required defaultValue={option.value} className={fieldClass} /></label>)}
          </fieldset>)}
          <div className="flex gap-2"><button className="rounded-full bg-primary px-5 py-2.5 text-sm text-white">{editing ? 'Save changes' : 'Create product'}</button>{editing && <button type="button" onClick={() => setEditing(null)} className="px-3 text-sm text-muted">Cancel</button>}</div>
        </form>
        <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{products.map((product) => <article key={product._id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-medium text-ink">{product.name}</h3><p className="mt-1 text-xs text-muted">{product.category} · {money(product.price, product.currencyCode)} · {product.stock} stock</p></div><div className="flex gap-3"><button onClick={() => { setEditing(product); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-sm text-primary">Edit</button><button onClick={() => deleteProduct(product._id)} className="text-sm text-red-400">Delete</button></div></article>)}</div>
      </div>}
      {panel === 'categories' && <div className="mt-7 max-w-2xl"><p className="text-sm text-muted">Categories come from Shopify product types. Change a product's category in the product editor.</p><div className="mt-6 space-y-3">{categories.map(category => <p key={category._id} className="text-ink">{category.name}</p>)}</div></div>}
      {panel === 'orders' && <div className="mt-7 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{orders.map((order) => <article key={order._id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div><p className="font-mono text-xs text-muted">{order._id}{order.shopifyOrderName ? ` · ${order.shopifyOrderName}` : ''}</p><p className="mt-1 text-sm text-ink">{order.user?.name || 'Customer'} · {money(order.totalAmount, order.currencyCode)}</p><p className="mt-1 text-xs text-muted">{order.products.map((item) => `${item.name} × ${item.quantity}`).join(', ')} · {order.paymentMethod} / {order.paymentStatus}{order.creationStatus && order.creationStatus !== 'ready' ? ' / needs review' : ''} · {new Date(order.createdAt).toLocaleDateString()}</p></div><select aria-label={`Update order ${order._id}`} value={order.orderStatus} onChange={(event) => setOrderStatus(order._id, event.target.value)} className={fieldClass + ' w-40'}>{['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select></article>)}</div>}
      {panel === 'users' && <div className="mt-7 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{users.map((customer) => <div key={customer._id} className="flex justify-between gap-4 py-4 text-sm"><span className="text-ink">{customer.name}<span className="block text-xs text-muted">{customer.email}</span></span><span className="text-xs uppercase text-muted">{customer.role}</span></div>)}</div>}
      {panel === 'reviews' && <div className="mt-7 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{reviews.map((review) => <article key={review._id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="text-sm text-primary">{'★'.repeat(review.rating)} <span className="text-ink">{review.product?.name || 'Product'}</span></p><p className="mt-1 text-sm text-muted">{review.comment || 'No written comment'} · {review.user?.name || 'Customer'}</p></div><button onClick={() => removeReview(review._id)} className="text-sm text-red-400">Remove</button></article>)}</div>}
      {panel === 'messages' && <div className="mt-7 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">{messages.map((message) => <article key={message._id} className="py-5"><div className="flex justify-between gap-3"><h3 className="font-medium text-ink">{message.subject}</h3><span className="text-xs text-muted">{new Date(message.createdAt).toLocaleDateString()}</span></div><p className="mt-1 text-xs text-muted">{message.name} · {message.email}</p><p className="mt-3 whitespace-pre-wrap text-sm text-ink">{message.message}</p></article>)}</div>}
    </section>
  );
}
