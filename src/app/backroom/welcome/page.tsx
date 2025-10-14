import Image from 'next/image';
import Share from '@/components/Share';

export default function BackroomWelcome() {
  return (
    <main className="min-h-screen bg-slate-900 text-amber-50 py-3 px-4">
      <div className="container mx-auto max-w-md">
        <div className="py-4 flex justify-center">
          <Image src="/backroom-logo.png" alt="The Backroom Club" width={260} height={80} priority />
        </div>
        <div className="bg-slate-800 rounded-lg p-5 shadow-lg text-center">
          <p className="text-amber-100 italic mb-6" style={{ fontFamily: 'var(--font-quote)' }}>
            You're in kid. <br />Welcome to the Backroom Club.
          </p>

          <p className="text-amber-100 mb-4">
            Tony flicks a match, lights a cigarette, and smirks.
          </p>
          <div className="mb-6 flex items-start gap-3 justify-center">
            <div className="flex-shrink-0">
              <Image src="/tony-wink.png" alt="Tony wink" width={80} height={80} className="rounded-full shadow" priority />
            </div>
            <p className="text-amber-200 text-left" style={{ fontFamily: 'var(--font-quote)' }}>
              "Had a feeling you're the follow-through type. I like that.
              <br /><br />
              Anything juicy? You'll be the first to know — the real stuff, off-menu.
              <br /><br />
              In fact, the boys upstairs are hard at work on a thing called <strong>NomStack</strong>. You may hear about it before the papers do.”
            </p>
          </div>

          <p className="text-amber-100 mb-4">
            Keep it under your hat, pal. If you gotta spill, make sure it's only to hip cats.
          </p>
          Spill anyway...<br /><br />
          <Share share={{ url: 'https://thelowdine.com/backroom/subscribe', shareText: 'Check out The Backroom Club!', mailSubject: 'The Backroom Club', mailBody: 'Check out The Backroom Club!', smsBody: 'Check out The Backroom Club!' }} />
          <br />
          <a
            href="/"
            className="inline-block border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black transition-all duration-200 px-5 py-2 rounded-sm uppercase tracking-wider"
          >
            Head Back to The Lowdine →
          </a>
        </div>
        <footer className="text-xs text-amber-300/70 mt-6 text-center">
          <p>Membership has its privileges. And its silence.</p>
        </footer>
      </div>
    </main>
  );
}
