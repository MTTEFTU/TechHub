'use client';

import { useLocale } from '@/context/LocaleContext';
import { Reveal } from './Reveal';

const icons = [
  <path key="1" d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  <path key="2" d="M20 7H4a1 1 0 00-1 1v9a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM16 3v4M8 3v4" />,
  <path key="3" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
  <path key="4" d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />,
  <path key="5" d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />,
  <path key="6" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
];

export function Features() {
  const { t } = useLocale();

  const features = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`features.f${i}.title`),
    body: t(`features.f${i}.body`),
    icon: icons[i - 1],
  }));

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{t('features.title')}</h2>
        <p className="mt-4 text-muted">{t('features.subtitle')}</p>
      </Reveal>

      <Reveal stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="hover-lift rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {f.icon}
            </svg>
            <h3 className="mt-4 font-heading text-base font-semibold text-ink">{f.title}</h3>
            <p className="mt-2 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
