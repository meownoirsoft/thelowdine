
export default function TipTony() {
    return (
    <div className="mt-4 pt-3 border-t border-amber-900/40">
        <p className="text-center text-amber-300 text-sm mb-2" style={{ fontFamily: 'var(--font-quote)' }}>
            Wanna tip Tony for the pick?
        </p>
        <div className="flex items-center justify-center gap-3">
            <a
            href="https://ko-fi.com/thelowdine"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-sm"
            style={{ fontFamily: 'var(--font-quote)' }}
            >
            Buy Tony a Ko-fi
            </a>
            <a
            href="https://www.buymeacoffee.com/thelowdine"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-500 text-slate-900 text-sm shadow ring-1 ring-amber-500/60"
            style={{ fontFamily: 'var(--font-quote)' }}
            >
            Buy Tony a Coffee
            </a>
        </div>
    </div>
    );
}