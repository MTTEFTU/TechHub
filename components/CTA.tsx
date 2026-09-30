'use client';

import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';
import { Reveal } from './Reveal';

export function CTA() {
  const { t } = useLocale();

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 px-8 py-16 text-center">
          <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{t('cta.title')}</h2>
          <p className="mx-auto mt-4 max-w-md text-muted">{t('cta.subtitle')}</p>
          <Link
            href="#products"
            className="mt-8 inline-block rounded-full bg-primary px-7 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            {t('cta.button')}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
