import './globals.css';
import type { Metadata } from 'next';
import { Libre_Baskerville, Special_Elite, Old_Standard_TT } from 'next/font/google';
import { PostHogProvider } from '../components/PostHogProvider';
import SiteFooter from '../components/SiteFooter';

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
  title: 'The Lowdine - Dinner Decider',
  description: 'Let Tony Spinelli decide your feast fate',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.className} ${quote.variable} ${tony.variable}`}>  
      <head>
        <link rel="preload" as="image" href="/thelowdine-logo.webp" />
        <link rel="preload" as="image" href="/backroom-logo.webp" />
        <link rel="preconnect" href="https://us.posthog.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//us.posthog.com" />
        <link rel="preconnect" href="https://buttondown.email" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//buttondown.email" />
      </head>
      <body className="speakeasy">
        <PostHogProvider>
          {children}
          <SiteFooter />
        </PostHogProvider>
      </body>
    </html>
  );
}