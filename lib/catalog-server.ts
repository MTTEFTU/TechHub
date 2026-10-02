import 'server-only';
import { unstable_cache } from 'next/cache';
import { API_URL } from './api';
export const CATALOG_TAG = 'shopify-products';
export const catalogRequest = unstable_cache(async (path: string) => {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error('Shopify catalog is temporarily unavailable.'), { status: response.status });
  return body;
}, ['shopify-catalog-v1'], { tags: [CATALOG_TAG], revalidate: 60 });
