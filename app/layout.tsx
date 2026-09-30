import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Tech Hub — Electronics worth owning',
  description:
    'Phones, laptops, audio, and smart home gear — sourced, tested, and shipped fast.',
  openGraph: {
    title: 'Tech Hub — Electronics worth owning',
    description:
      'Phones, laptops, audio, and smart home gear — sourced, tested, and shipped fast.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tech Hub — Electronics worth owning',
    description:
      'Phones, laptops, audio, and smart home gear — sourced, tested, and shipped fast.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.variable} page-fade font-body`}>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
