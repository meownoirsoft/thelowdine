import Image from 'next/image';
import Share from '@/components/Share';

export default function Success() {
  return (
    <main className="min-h-screen bg-slate-900 text-amber-50 py-6 px-4">
      <div className="container mx-auto max-w-md">
        <div className="py-4 flex justify-center">
          <Image src="/backroom-logo.webp" alt="The Backroom Club" width={260} height={80} priority />
        </div>
        <div className="bg-slate-800 rounded-lg p-5 shadow-lg text-center">
          <p className="text-amber-100 italic mb-6" style={{ fontFamily: 'var(--font-quote)' }}>
            The door swings shut behind you. The music’s quieter here — smoke, whispers, the clink of a glass.
          </p>

          <p className="text-amber-100 mb-4">Tony gives a nod from the corner.</p>
          <div className="mb-6 flex items-start gap-3 justify-center">
            <div className="flex-shrink-0">
              <Image src="/tony-wink.webp" alt="Tony wink" width={80} height={80} className="rounded-full shadow" priority />
            </div>
            <p className="text-amber-200 text-left" style={{ fontFamily: 'var(--font-quote)' }}>
              “I knew you'd find the place, you just had that look in your eyes. Good instincts.
              <br /><br />
              Keep your head down and your eyes open — word travels fast in slow rooms.”
            </p>
          </div>

          <p className="text-amber-100 mb-8">
            You're in now. Expect the occasional whisper from me with some juicy tidbits.
            <br />
            <br />
            If anyone asks how you got in… <em>you don’t remember.</em> Wink, wink.
          </p>
          Spill anyway...<br />
          <br />
          <Share share={{ url: 'https://thelowdine.com/backroom/subscribe', shareText: 'Check out The Backroom Club!', mailSubject: 'The Backroom Club', mailBody: 'Check out The Backroom Club!', smsBody: 'Check out The Backroom Club!' }} />
          <br />
          <a
            href="/"
            className="inline-block border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black transition-all duration-200 px-5 py-2 rounded-sm uppercase tracking-wider"
          >
            Return to The Lowdine →
          </a>
        </div>
      </div>
    </main>
  );
}
