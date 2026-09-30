'use client';

import { useState, FormEvent } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { Reveal } from '@/components/Reveal';
import { apiRequest } from '@/lib/api';

export default function ContactPage() {
  const { t } = useLocale();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await apiRequest('/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(form.entries())) });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold text-ink sm:text-5xl">{t('contact.title')}</h1>
        <p className="mt-4 text-muted">{t('contact.subtitle')}</p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-2">
        <Reveal>
          {sent ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
              <p className="text-ink">{t('contact.sent')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
              <div>
                <label htmlFor="name" className="mb-1 block text-sm text-muted">
                  {t('contact.name')}
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  type="text"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm text-muted">
                  {t('contact.email')}
                </label>
                <input
                  id="email"
                  name="email"
                  required
                  type="email"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="subject" className="mb-1 block text-sm text-muted">Subject</label>
                <input id="subject" name="subject" required className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-primary" />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm text-muted">Phone</label>
                <input id="phone" name="phone" type="tel" className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-primary" />
              </div>
              <div>
                <label htmlFor="message" className="mb-1 block text-sm text-muted">
                  {t('contact.message')}
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                {t('contact.send')}
              </button>
            </form>
          )}
        </Reveal>

        <Reveal>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
            <h2 className="font-heading text-lg font-semibold text-ink">{t('contact.otherTitle')}</h2>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-muted">{t('contact.email.label')}</dt>
                <dd className="mt-1 text-ink">support@techhub.example</dd>
              </div>
              <div>
                <dt className="text-muted">{t('contact.phone.label')}</dt>
                <dd className="mt-1 text-ink">+1 (555) 019-2044</dd>
              </div>
              <div>
                <dt className="text-muted">{t('contact.hours.label')}</dt>
                <dd className="mt-1 text-ink">{t('contact.hours.value')}</dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
