'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from '@/context/LocaleContext';
import { useCart } from '@/context/CartContext';
import { Reveal } from '@/components/Reveal';

export default function CartPage() {
  const { t } = useLocale();
  const { items, removeItem, setQty, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <Reveal>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t('cart.empty')}</h1>
          <p className="mt-3 text-muted">{t('cart.emptyBody')}</p>
          <Link
            href="/#products"
            className="mt-8 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {t('cart.browse')}
          </Link>
        </Reveal>
      </section>
    );
  }

  const shippingCost = subtotal >= 75 || subtotal === 0 ? 0 : 9;
  const total = subtotal + shippingCost;

  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <Reveal>
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t('cart.title')}</h1>
      </Reveal>

      <Reveal className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {items.map(({ product, qty }) => (
          <div key={product.id} className="flex items-center gap-4 py-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md">
              <Image src={product.image} alt={product.name} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-sm font-semibold text-ink">{product.name}</h3>
              <p className="mt-1 text-sm text-muted">${product.price}</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`qty-${product.id}`} className="sr-only">
                {t('cart.qty')}
              </label>
              <input
                id={`qty-${product.id}`}
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(product.id, parseInt(e.target.value, 10) || 1)}
                className="w-16 rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <p className="w-20 text-right font-heading text-sm font-semibold text-ink">
              ${(product.price * qty).toFixed(0)}
            </p>
            <button
              onClick={() => removeItem(product.id)}
              aria-label={`${t('cart.remove')} ${product.name}`}
              className="text-muted transition-colors hover:text-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </Reveal>

      <Reveal className="ml-auto mt-8 max-w-xs space-y-3">
        <div className="flex justify-between text-sm text-muted">
          <span>{t('cart.subtotal')}</span>
          <span>${subtotal.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted">
          <span>{t('cart.shipping')}</span>
          <span>{shippingCost === 0 ? t('cart.shippingFree') : `$${shippingCost}`}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-3 font-heading text-base font-semibold text-ink">
          <span>{t('cart.total')}</span>
          <span>${total.toFixed(0)}</span>
        </div>
        <Link href="/checkout" className="mt-4 block w-full rounded-full bg-primary px-6 py-3 text-center text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
          {t('cart.checkout')}
        </Link>
      </Reveal>
    </section>
  );
}
