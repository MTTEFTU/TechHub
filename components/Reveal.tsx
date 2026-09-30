'use client';

import { ReactNode } from 'react';
import { useReveal } from '@/lib/useReveal';

export function Reveal({
  children,
  className = '',
  stagger = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${stagger ? 'reveal-stagger' : 'reveal'} ${className}`}>
      {children}
    </div>
  );
}
