const configuredApiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

export const API_URL = `${configuredApiOrigin}/api`;

export type ApiUser = { id: string; name: string; email: string; phone: string; role: 'user' | 'admin' };

export type ApiProduct = {
  _id: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  discountPrice?: number | null;
  images?: string[];
  image?: string;
  shortDescription?: string;
  description?: string;
  stock?: number;
  rating?: number;
  featured?: boolean;
  shopifyProductId?: string;
  shopifyVariantId?: string;
};

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error(`Cannot reach the Tech Hub API at ${API_URL}${path}. Check NEXT_PUBLIC_API_URL and confirm the backend is running with MongoDB connected.`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'The request could not be completed.');
  return body as T;
}

export function productImage(product: ApiProduct): string {
  return product.images?.[0] || product.image || '/product-placeholder.svg';
}
