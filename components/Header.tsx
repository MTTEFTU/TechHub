'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/context/LocaleContext';
import { useCart } from '@/context/CartContext';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '@/context/AuthContext';

export function Header() {
  const { t } = useLocale();
  const { items } = useCart();
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const count = items.reduce((n, i) => n + i.qty, 0);

  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/products', label: 'Products' },
    { href: '/about', label: t('nav.about') },
    { href: '/pricing', label: t('nav.pricing') },
    { href: '/faq', label: t('nav.faq') },
    { href: '/contact', label: t('nav.contact') },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">
            TH
          </span>
          Tech Hub
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors hover:text-primary ${
                pathname === link.href ? 'text-primary' : 'text-muted'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link
            href="/cart"
            aria-label={t('nav.cart')}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-ink transition-colors hover:border-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              {user.role === 'admin' && <Link href="/admin" className="hidden text-xs text-primary sm:inline">Admin</Link>}
              <Link href="/account" className="hidden text-sm text-ink sm:inline">{user.name.split(' ')[0]}</Link>
              <button onClick={signOut} className="hidden text-xs text-muted hover:text-primary sm:inline">Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm text-muted hover:text-primary sm:inline">Sign in</Link>
              <Link href="/register" className="hidden rounded-full bg-primary px-4 py-2 text-xs font-medium text-white sm:inline">Sign up</Link>
            </>
          )}
          <button
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] text-ink md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-[var(--color-border)] px-6 py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`rounded-md px-2 py-2 text-sm ${
                pathname === link.href ? 'text-primary' : 'text-muted'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user ? <><Link href="/account" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted">My account &amp; orders</Link>{user.role === 'admin' && <Link href="/admin" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-primary">Admin dashboard</Link>}<button onClick={() => { signOut(); setMenuOpen(false); }} className="px-2 py-2 text-left text-sm text-muted">Log out</button></> : <><Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted">Sign in</Link><Link href="/register" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted">Sign up</Link></>}
        </nav>
      )}
    </header>
  );
}
