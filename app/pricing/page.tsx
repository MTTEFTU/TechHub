'use client';

import { useLocale } from '@/context/LocaleContext';
import { Reveal } from '@/components/Reveal';

export default function PricingPage() {
  const { t } = useLocale();

  const tiers = [
    {
      name: t('pricing.standard'),
      price: t('pricing.standard.price'),
      desc: t('pricing.standard.desc'),
      features: [t('pricing.f1'), t('pricing.f2'), t('pricing.f3')],
      popular: false,
    },
    {
      name: t('pricing.express'),
      price: t('pricing.express.price'),
      desc: t('pricing.express.desc'),
      features: [t('pricing.f1'), t('pricing.f2'), t('pricing.f3'), t('pricing.f4')],
      popular: true,
    },
    {
      name: t('pricing.priority'),
      price: t('pricing.priority.price'),
      desc: t('pricing.priority.desc'),
      features: [t('pricing.f1'), t('pricing.f2'), t('pricing.f3'), t('pricing.f4'), t('pricing.f5')],
      popular: false,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold text-ink sm:text-5xl">{t('pricing.title')}</h1>
        <p className="mt-4 text-muted">{t('pricing.subtitle')}</p>
      </Reveal>

      <Reveal stagger className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`hover-lift relative flex flex-col rounded-lg border p-8 ${
              tier.popular
                ? 'border-primary bg-[var(--color-surface)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                {t('pricing.mostPopular')}
              </span>
            )}
            <h3 className="font-heading text-lg font-semibold text-ink">{tier.name}</h3>
            <p className="mt-4 font-heading text-4xl font-semibold text-ink">{tier.price}</p>
            <p className="mt-2 text-sm text-muted">{tier.desc}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-muted">
              {tier.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`mt-8 rounded-full px-6 py-3 text-sm font-medium transition-transform hover:-translate-y-0.5 ${
                tier.popular ? 'bg-primary text-white' : 'border border-[var(--color-border)] text-ink'
              }`}
            >
              {t('pricing.choose')}
            </button>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
