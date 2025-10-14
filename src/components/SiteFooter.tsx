"use client";

import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-8 text-center text-amber-300/80 text-sm">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <Link href="/?about=1" className="underline hover:text-amber-200">About</Link>
        <Link href="/?contact=1" className="underline hover:text-amber-200">Contact</Link>
        <Link href="/privacy" className="underline hover:text-amber-200">Privacy</Link>
      </div>
      <div className="mt-2 opacity-80">
        © 2025 Meow Noir Developments, LLC. All rights reserved.
      </div>
    </footer>
  );
}
