export default function Share({ share, copied, setCopied }: { share: { url: string; shareText: string; mailSubject: string; mailBody: string; smsBody: string }; copied: boolean; setCopied: (copied: boolean) => void }) {
    return (
        <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
            <a
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
            href={`https://twitter.com/intent/tweet?text=${share.shareText}&url=${encodeURIComponent(share.url)}`}
            target="_blank" rel="noopener noreferrer"
            >
            Twitter
            </a>
            <a
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
            href={`mailto:?subject=${share.mailSubject}&body=${share.mailBody}`}
            >
            Email
            </a>
            <a
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-amber-50"
            href={`sms:?&body=${share.smsBody}`}
            >
            SMS
            </a>
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
        </div>
        );
}