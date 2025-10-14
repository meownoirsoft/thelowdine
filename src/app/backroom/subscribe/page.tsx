export const dynamic = "force-static";
import Image from 'next/image';

export default function SubscribePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-amber-50 py-6 px-4">
      <div className="container mx-auto max-w-md">
        <div className="py-4 flex justify-center">
          <Image src="/backroom-logo.png" alt="The Backroom Club" width={260} height={80} priority />
        </div>
        <div className="bg-slate-800 rounded-lg p-5 shadow-lg">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex-shrink-0">
              <Image src="/tony-wink.png" alt="Tony wink" width={80} height={80} className="rounded-full shadow" priority />
            </div>
            <p className="text-amber-100" style={{ fontFamily: 'var(--font-quote)' }}>
              Well, you found it! The inside scoop on Tony's movements behind the curtain. Very hush hush.
            </p>
          </div>
          <form
            action="https://buttondown.email/api/emails/embed-subscribe/thelowdine"
            method="post"
            className="flex flex-col gap-3 items-stretch"
          >
            <input type="hidden" name="embed" value="1" />
            <label className="text-sm text-amber-200" htmlFor="bd-email" style={{ fontFamily: 'var(--font-quote)' }}>
              Club Password (your email address)
            </label>
            <input
              id="bd-email"
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-700 text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={{ fontFamily: 'var(--font-quote)' }}
            />
            <button
              type="submit"
              className="mt-2 px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              style={{ fontFamily: 'var(--font-quote)' }}
            >
              Join the Backroom Club
            </button>
          </form>
          <p className="mt-3 text-xs text-center text-amber-300" style={{ fontFamily: 'var(--font-quote)' }}>
            Powered by Buttondown. You can always unsubscribe in one click.
          </p>
        </div>
      </div>
    </main>
  );
}
