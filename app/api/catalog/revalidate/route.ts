import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { CATALOG_TAG } from '@/lib/catalog-server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_REVALIDATION_SECRET;
  const supplied = request.headers.get('x-tech-hub-revalidation') || '';
  if (!secret) return NextResponse.json({ message: 'Revalidation is not configured.' }, { status: 503 });
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  revalidateTag(CATALOG_TAG);
  return NextResponse.json({ revalidated: true });
}
