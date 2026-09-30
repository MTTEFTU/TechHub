'use client';

import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';
import { Reveal } from './Reveal';

export function Hero() {
  const { t } = useLocale();

  const stats = [
    { n: t('hero.stat1n'), l: t('hero.stat1l') },
    { n: t('hero.stat2n'), l: t('hero.stat2l') },
    { n: t('hero.stat3n'), l: t('hero.stat3l') },
  ];

  return (
    <section id="hero" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-30 blur-3xl animate-drift"
        style={{
          background:
            'radial-gradient(circle, var(--color-primary) 0%, var(--color-secondary) 45%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-20 text-center sm:pt-28">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-muted">
            {t('hero.eyebrow')}
          </span>
        </Reveal>
        <Reveal>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-ink sm:text-6xl">
            {t('hero.title')}
          </h1>
        </Reveal>
        <Reveal>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            {t('hero.subtitle')}
          </p>
        </Reveal>
        <Reveal>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#products"
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              {t('hero.ctaPrimary')}
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-primary"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
        </Reveal>

        <Reveal stagger>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-4 border-t border-[var(--color-border)] pt-8">
            {stats.map((s) => (
              <div key={s.l}>
                <p className="font-heading text-2xl font-semibold text-ink sm:text-3xl">{s.n}</p>
                <p className="mt-1 text-xs text-muted sm:text-sm">{s.l}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
