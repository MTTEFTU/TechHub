'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PRODUCT_PLACEHOLDER } from '@/lib/product-presentation';

export function ProductImage({ src, alt, sizes }: { src?: string; alt: string; sizes: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const placeholder = !src || src === PRODUCT_PLACEHOLDER || failedSource === src;
  // A local SVG rendered inline stays visible even if a remote image fails.
  if (placeholder) return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface)]" role="img" aria-label={`${alt}: image unavailable`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PRODUCT_PLACEHOLDER} alt="" aria-hidden="true" className="h-full w-full object-contain p-8" />
    </div>
  );
  return <Image src={src!} alt={alt} fill sizes={sizes}
    onError={() => setFailedSource(src!)}
    className="object-cover transition-transform duration-500 group-hover:scale-105" />;
}
