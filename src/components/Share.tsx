"use client";

import { useState } from 'react';

type ShareData = {
  url: string;
  shareText: string;
  mailSubject: string;
  mailBody: string;
  smsBody: string;
};

export default function Share({ share }: { share: ShareData }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
            <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
                onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(share.url);
                      setCopied(true);
                    } catch {}
                }}
                >
                {copied ? 'Copied!' : 'Link'}
            </button>
            <a
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
            href={`sms:?&body=${encodeURIComponent(share.smsBody)}`}
            >
            SMS
            </a>
            <a
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
            href={`mailto:?subject=${encodeURIComponent(share.mailSubject)}&body=${encodeURIComponent(share.mailBody)}`}
            >
            Email
            </a>
            <a
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(share.shareText)}&url=${encodeURIComponent(share.url)}`}
              target="_blank" rel="noopener noreferrer"
            >
              Twitter
            </a>
            <a
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share.url)}`}
              target="_blank" rel="noopener noreferrer"
            >
              Facebook
            </a>
            <a
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
              href={`https://wa.me/?text=${encodeURIComponent(share.smsBody)}`}
              target="_blank" rel="noopener noreferrer"
            >
              WhatsApp
            </a>
        </div>
        );
}