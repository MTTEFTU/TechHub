'use client';

import { useEffect, useState } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { API_URL, ApiProduct, productImage } from '@/lib/api';
import { Product } from '@/lib/products';

type Category = { _id: string; name: string };
function toProduct(product: ApiProduct): Product {
  return { id: product._id, name: product.name, category: product.category, price: product.discountPrice ?? product.price, image: productImage(product), blurb: product.shortDescription || product.description || product.brand || '', stock: product.stock ?? 0, rating: product.rating ?? 0 };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/categories`).then((response) => response.ok ? response.json() : Promise.reject()).then((result) => setCategories(result.categories)).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ sort });
      if (search.trim()) params.set('search', search.trim());
      if (category) params.set('category', category);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (inStock) params.set('inStock', 'true');
      try {
        const response = await fetch(`${API_URL}/products?${params}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Products could not be loaded.');
        setProducts(result.products.map(toProduct));
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'API unavailable. Start the backend and connect MongoDB.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, category, minPrice, maxPrice, sort, inStock]);

  const fieldClass = 'rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm text-ink';
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <p className="text-xs uppercase text-primary">Tech Hub collection</p>
      <h1 className="mt-2 font-heading text-4xl font-semibold text-ink">Shop electronics</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products" className={`${fieldClass} lg:col-span-2`} />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category" className={fieldClass}><option value="">All categories</option>{categories.map((item) => <option key={item._id} value={item.name}>{item.name}</option>)}</select>
        <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} type="number" min="0" placeholder="Min price" aria-label="Minimum price" className={fieldClass} />
        <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} type="number" min="0" placeholder="Max price" aria-label="Maximum price" className={fieldClass} />
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products" className={fieldClass}><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="rating">Top rated</option></select>
      </div>
      <label className="mt-4 inline-flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} /> In stock only</label>
      {error && <p role="alert" className="mt-8 border-l-2 border-primary pl-4 text-sm text-muted">{error}</p>}
      {loading ? <p className="py-16 text-center text-muted">Loading products...</p> : products.length ? <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : !error && <p className="py-16 text-center text-muted">No products match those filters.</p>}
    </section>
  );
}