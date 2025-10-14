import './globals.css';
import type { Metadata } from 'next';
import { Bodoni_Moda, Libre_Baskerville, Special_Elite, Old_Standard_TT } from 'next/font/google';

const display = Bodoni_Moda({ subsets: ['latin'], weight: ['700'] });
const body = Libre_Baskerville({ subsets: ['latin'], weight: ['400','700'] });
const quote = Special_Elite({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-quote',
});
const tony = Old_Standard_TT({
  subsets: ['latin'],
  weight: ['400','700'],
  display: 'swap',
  variable: '--font-tony',
});

export const metadata: Metadata = {
  title: 'The Lowdine - Speakeasy No Drama Dinner Decider',
  description: 'Let Tony Spinelli decide your feast',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.className} ${quote.variable} ${tony.variable}`}>
      <body className={`speakeasy`}>{children}</body>
    </html>
  );
}
