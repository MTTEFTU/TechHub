import { NextResponse } from 'next/server';
import { catalogRequest } from '@/lib/catalog-server';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try { return NextResponse.json(await catalogRequest(`/products/${encodeURIComponent(params.id)}`)); }
  catch (error) { const status = (error as { status?: number }).status === 404 ? 404 : 502; return NextResponse.json({ message: 'This Shopify product is unavailable.' }, { status }); }
}
