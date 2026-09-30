'use client';

import { useLocale } from '@/context/LocaleContext';
import { products } from '@/lib/products';
import { ProductCard } from './ProductCard';
import { Reveal } from './Reveal';
import { useEffect, useState } from 'react';
import { API_URL, ApiProduct, productImage } from '@/lib/api';

function displayProduct(product: ApiProduct) {
  return {
    id: product._id,
    name: product.name,
    category: product.category,
    price: product.discountPrice ?? product.price,
    image: productImage(product),
    blurb: product.shortDescription || product.description || product.brand || '',
    stock: product.stock ?? 0,
    rating: product.rating ?? 0,
  };
}

export function ProductGrid() {
  const { t } = useLocale();
  const [catalog, setCatalog] = useState(products);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result: { products: ApiProduct[] }) => setCatalog(result.products.map(displayProduct)))
      .catch(() => setCatalog(products));
  }, []);

  return (
    <section id="products" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{t('products.title')}</h2>
        <p className="mt-4 text-muted">{t('products.subtitle')}</p>
      </Reveal>

      <Reveal stagger className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </Reveal>
    </section>
  );
}
