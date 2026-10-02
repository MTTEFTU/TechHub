import { NextRequest, NextResponse } from 'next/server';
import { catalogRequest } from '@/lib/catalog-server';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const key of ['search', 'category', 'minPrice', 'maxPrice', 'inStock', 'featured', 'sort']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  try { return NextResponse.json(await catalogRequest(`/products?${params.toString()}`)); }
  catch { return NextResponse.json({ message: 'Shopify products could not be loaded.' }, { status: 502 }); }
}
