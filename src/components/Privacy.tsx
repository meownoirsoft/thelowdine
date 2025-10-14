export default function Privacy() {

    return (
<div className="lowdine-privacy space-y-6 text-amber-50 bg-slate-900 p-6 rounded-xl max-w-prose mx-auto">
  <h2 className="text-2xl font-bold text-amber-400 mb-2">🍸 The Lowdine Privacy Policy</h2>
  <p className="text-sm opacity-80">Last updated: October 2025</p>

  <p>
    Welcome to <strong>The Lowdine</strong>, a classy little corner of the web operated by
    <strong>Meow Noir Developments, LLC</strong> (“we,” “us,” or “our”). We believe privacy is like a good martini:
    best served neat, with no surprises. So here’s what goes on behind the curtain — and what doesn’t.
  </p>

  <h3 className="text-xl font-semibold text-amber-300">🕵️‍♂️ What We Collect (and Why)</h3>
  <p>We keep things light. The only data we collect is:</p>
  <ul className="list-disc pl-6 space-y-2">
    <li>
      <strong>App activity:</strong> Through <strong>PostHog</strong>, we track anonymous usage events — things like what
      cities or neighborhoods folks search for and which buttons get the most love. This helps us understand what
      markets we’re serving and how to improve the experience.
    </li>
    <li>
      <strong>Email (Backroom):</strong> If you stumble onto <em>The Backroom</em> and decide to drop your email, we’ll
      use it solely to send you the occasional update or invitation. No spam, no nonsense, no secret hand-offs.
    </li>
  </ul>
  <p>No personal dossiers, no automatic IP harvesting, no selling your info to shady third parties.</p>

  <h3 className="text-xl font-semibold text-amber-300">🍷 How We Use It</h3>
  <ul className="list-disc pl-6 space-y-2">
    <li>Keep the app running smoothly</li>
    <li>Understand where users are dining or searching</li>
    <li>Plan improvements based on real interest, not guesswork</li>
    <li>Send the rare message to folks who explicitly joined <em>The Backroom</em></li>
  </ul>

  <h3 className="text-xl font-semibold text-amber-300">🚫 Who We Share It With</h3>
  <p>
    We don’t. Except for trusted service providers (like PostHog for analytics or our email service for The Backroom),
    your data never leaves the establishment. Even then, it’s handled under strict agreements that keep your identity
    anonymous or encrypted.
  </p>
  <p>
    We’ll only disclose data if legally required — say, if the feds show up with a real warrant (not just a guy in a
    trench coat).
  </p>

  <h3 className="text-xl font-semibold text-amber-300">🍸 Cookies & Tracking</h3>
  <p>
    PostHog may use cookies or local storage to remember session info. They don’t serve ads or follow you around the
    web. If you block cookies, The Lowdine will still work just fine — we’ll just miss your charming company in our
    analytics.
  </p>

  <h3 className="text-xl font-semibold text-amber-300">💌 Your Choices</h3>
  <ul className="list-disc pl-6 space-y-2">
    <li>You can unsubscribe from The Backroom at any time via the link in our emails.</li>
    <li>
      If you want your data deleted, or just want to make sure we’ve got nothing on you, email us at
      <a href="mailto:privacy@thelowdine.com" className="text-amber-400 underline">privacy@thelowdine.com</a> — we’ll tidy
      things up promptly.
    </li>
  </ul>

  <h3 className="text-xl font-semibold text-amber-300">🕰️ Updates</h3>
  <p>
    If we ever change what we collect or how we use it, we’ll update this page. We don’t make a habit of surprises
    unless it’s a free dessert.
  </p>

  <h3 className="text-xl font-semibold text-amber-300">📞 Contact</h3>
  <p>
    Questions, concerns, or mysterious riddles?<br />
    Reach us anytime at&nbsp;
    <a href="mailto:privacy@thelowdine.com" className="text-amber-400 underline">privacy@thelowdine.com</a>.
  </p>

  <p className="pt-4 border-t border-amber-800/40 text-sm opacity-75">
    <strong>Meow Noir Developments, LLC</strong><br />
    Operator of <em>The Lowdine</em><br />
    Serving privacy with a side of class.
  </p>
    <br />
  <a href="https://thelowdine.com" className="text-amber-400 underline">Back to The Lowdine</a>
</div>
    )
}