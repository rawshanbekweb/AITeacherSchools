import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'AI Teacher', template: '%s · AI Teacher' },
  description: 'Bog‘cha, maktab va universitetlar uchun sun’iy intellekt o‘qituvchi platformasi',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#0b1020', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
