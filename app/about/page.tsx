'use client';

import { useLocale } from '@/context/LocaleContext';
import { Reveal } from '@/components/Reveal';
import { CTA } from '@/components/CTA';

export default function AboutPage() {
  const { t } = useLocale();

  const stats = [
    { label: t('about.statLabel1'), value: t('about.statValue1') },
    { label: t('about.statLabel2'), value: t('about.statValue2') },
    { label: t('about.statLabel3'), value: t('about.statValue3') },
  ];

  const values = [1, 2, 3].map((i) => ({
    title: t(`about.v${i}.title`),
    body: t(`about.v${i}.body`),
  }));

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Reveal>
          <h1 className="text-4xl font-semibold text-ink sm:text-5xl">{t('about.title')}</h1>
        </Reveal>
        <Reveal>
          <p className="mt-6 text-muted">{t('about.body1')}</p>
        </Reveal>
        <Reveal>
          <p className="mt-4 text-muted">{t('about.body2')}</p>
        </Reveal>

        <Reveal stagger className="mt-12 grid grid-cols-3 gap-4 border-t border-[var(--color-border)] pt-8">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-heading text-2xl font-semibold text-ink sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted sm:text-sm">{s.label}</p>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="text-center">
            <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{t('about.valuesTitle')}</h2>
          </Reveal>
          <Reveal stagger className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="hover-lift rounded-lg border border-[var(--color-border)] bg-background p-6">
                <h3 className="font-heading text-base font-semibold text-ink">{v.title}</h3>
                <p className="mt-2 text-sm text-muted">{v.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <CTA />
    </>
  );
}
