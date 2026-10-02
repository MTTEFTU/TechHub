'use client';

import countryCodes from '@/backend/data/checkout-countries.json';

const names = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = countryCodes.map(code => ({ code, name: names.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function CheckoutCountrySelect({ className, value, onChange }: { className: string; value?: string; onChange?: (value: string) => void }) {
  return (
    <label className="sm:col-span-2">
      <span className="mb-2 block text-sm font-medium text-ink">Shipping country</span>
      <select name="countryCode" autoComplete="country" required value={value} defaultValue={value === undefined ? "" : undefined} onChange={event => onChange?.(event.target.value)} className={className}>
        <option value="" disabled>Select your shipping country</option>
        {countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
      </select>
    </label>
  );
}
