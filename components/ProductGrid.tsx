'use client';

import { useLocale } from '@/context/LocaleContext';
import { Product, toProduct } from '@/lib/products';
import { ProductCard } from './ProductCard';
import { Reveal } from './Reveal';
import { useEffect, useState } from 'react';
import { ApiProduct } from '@/lib/api';


export function ProductGrid() {
  const { t } = useLocale();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/catalog')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result: { products: ApiProduct[] }) => setCatalog(result.products.map(p => toProduct(p))))
      .catch(() => setError('Products are temporarily unavailable. Please try again.'));
  }, []);

  return (
    <section id="products" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{t('products.title')}</h2>
        <p className="mt-4 text-muted">{t('products.subtitle')}</p>
      </Reveal>

      {error && <p role="alert" className="mt-8 text-center text-muted">{error}</p>}
      <Reveal stagger className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </Reveal>
    </section>
  );
}
