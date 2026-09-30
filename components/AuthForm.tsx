'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { signIn, register } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const registering = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (registering) {
        if (values.password !== values.confirmPassword) throw new Error('Passwords do not match.');
        await register({ name: String(values.name), email: String(values.email), phone: String(values.phone), password: String(values.password) });
      } else {
        await signIn(String(values.email), String(values.password));
      }
      router.push('/account');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in. Please try again.');
    } finally { setBusy(false); }
  }

  const inputClass = 'w-full rounded-md border border-[var(--color-border)] bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-primary';
  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-heading text-3xl font-semibold text-ink">{registering ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-2 text-sm text-muted">{registering ? 'Join Tech Hub for a better way to shop.' : 'Sign in to manage your account and orders.'}</p>
      {error && <p role="alert" className="mt-5 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <form onSubmit={submit} className="mt-7 space-y-4">
        {registering && <>
          <input className={inputClass} name="name" autoComplete="name" placeholder="Full name" required maxLength={100} />
          <input className={inputClass} name="phone" autoComplete="tel" placeholder="Phone number" />
        </>}
        <input className={inputClass} name="email" type="email" autoComplete="email" placeholder="Email address" required />
        <input className={inputClass} name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} placeholder="Password" minLength={8} required />
        {registering && <input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm password" minLength={8} required />}
        <button disabled={busy} className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-sm text-muted">{registering ? 'Already have an account?' : 'New to Tech Hub?'}{' '}
        <Link className="text-primary hover:underline" href={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link>
      </p>
    </section>
  );
}