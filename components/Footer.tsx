'use client';

import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-[var(--color-border)] bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">
                TH
              </span>
              Tech Hub
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted">{t('footer.tagline')}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h4 className="mb-3 text-sm font-medium text-ink">{t('nav.home')}</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link href="/" className="hover:text-primary">{t('nav.home')}</Link></li>
                <li><Link href="/pricing" className="hover:text-primary">{t('nav.pricing')}</Link></li>
                <li><Link href="/cart" className="hover:text-primary">{t('nav.cart')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-medium text-ink">{t('nav.about')}</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link href="/about" className="hover:text-primary">{t('nav.about')}</Link></li>
                <li><Link href="/faq" className="hover:text-primary">{t('nav.faq')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-medium text-ink">{t('nav.contact')}</h4>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link href="/contact" className="hover:text-primary">{t('nav.contact')}</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--color-border)] pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Tech Hub. {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
