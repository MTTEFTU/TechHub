'use client';

import { useLocale } from '@/context/LocaleContext';
import { Reveal } from './Reveal';

export function HowItWorks() {
  const { t } = useLocale();

  const steps = [1, 2, 3, 4].map((i) => ({
    title: t(`how.s${i}.title`),
    body: t(`how.s${i}.body`),
  }));

  return (
    <section id="how-it-works" className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{t('how.title')}</h2>
          <p className="mt-4 text-muted">{t('how.subtitle')}</p>
        </Reveal>

        <Reveal stagger className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, idx) => (
            <div key={s.title} className="relative pl-10">
              <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-primary text-xs font-semibold text-primary">
                {idx + 1}
              </span>
              <h3 className="font-heading text-base font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
