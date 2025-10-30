import './globals.css';
import './fonts.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';

import SiteFooter from '../components/SiteFooter';

const body = localFont({
  src: [
    {
      path: '../../public/fonts/Libre_Baskerville/LibreBaskerville-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Libre_Baskerville/LibreBaskerville-Bold.ttf',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-body',
  fallback: ['Georgia', 'serif']
});

const quote = localFont({
  src: '../../public/fonts/Special_Elite/SpecialElite-Regular.ttf',
  variable: '--font-quote',
  fallback: ['Courier New', 'monospace']
});

const tony = localFont({
  src: [
    {
      path: '../../public/fonts/Old_Standard_TT/OldStandardTT-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Old_Standard_TT/OldStandardTT-Bold.ttf',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-tony',
  fallback: ['Georgia', 'serif']
});

export const metadata: Metadata = {
  title: 'The Lowdine - Eat Out Roulette',
  description: 'Let Tony Spinelli decide your feast fate',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.className} ${quote.className} ${tony.className} ${quote.variable} ${tony.variable} bg-slate-900`}>
      <head>
        <Script
          defer
          data-domain="thelowdine.com"
          src="https://plausible.io/js/script.js"
        />
        <style dangerouslySetInnerHTML={{__html: `
          :root {
            --font-quote: ${quote.style.fontFamily};
            --font-tony: ${tony.style.fontFamily};
          }
          html, body {
            margin: 0;
            padding: 0;
            background-color: #0f172a !important;
            color: #fef9c3 !important;
            min-height: 100vh;
          }
          * {
            box-sizing: border-box;
          }
          body > * {
            background-color: #0f172a;
          }
        `}} />
        
        <link rel="preload" as="image" href="/thelowdine-logo.webp" />
        <link rel="preload" as="image" href="/backroom-logo.webp" />

        <link rel="preconnect" href="https://buttondown.email" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//buttondown.email" />
      </head>
      <body className="speakeasy min-h-screen bg-slate-900">
        <noscript>
          <style dangerouslySetInnerHTML={{__html: `
            body { display: block !important; }
          `}} />
        </noscript>
          {children}
          <SiteFooter />
      </body>
    </html>
  );
}