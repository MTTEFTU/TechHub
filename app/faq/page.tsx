'use client';

import { useState } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { Reveal } from '@/components/Reveal';
import { CTA } from '@/components/CTA';

export default function FaqPage() {
  const { t } = useLocale();
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [1, 2, 3, 4, 5].map((i) => ({
    q: t(`faq.q${i}`),
    a: t(`faq.a${i}`),
  }));

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 py-20">
        <Reveal className="text-center">
          <h1 className="text-4xl font-semibold text-ink sm:text-5xl">{t('faq.title')}</h1>
          <p className="mt-4 text-muted">{t('faq.subtitle')}</p>
        </Reveal>

        <Reveal stagger className="mt-14 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-heading text-sm font-medium text-ink sm:text-base">{f.q}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-45' : ''}`}
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                {isOpen && <p className="px-6 pb-5 text-sm text-muted">{f.a}</p>}
              </div>
            );
          })}
        </Reveal>
      </section>

      <CTA />
    </>
  );
}
