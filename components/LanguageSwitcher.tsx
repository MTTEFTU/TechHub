'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { locales, localeNames } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 items-center gap-1 rounded-full border border-[var(--color-border)] px-3 text-sm text-ink transition-colors hover:border-primary"
      >
        {locale.toUpperCase()}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-32 overflow-hidden rounded-md border border-[var(--color-border)] bg-background shadow-lg"
        >
          {locales.map((l) => (
            <li key={l}>
              <button
                role="option"
                aria-selected={l === locale}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface)] ${
                  l === locale ? 'text-primary' : 'text-ink'
                }`}
              >
                {localeNames[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
