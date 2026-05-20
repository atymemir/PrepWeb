import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* HERO */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
          Digital SAT • Practice + Review + Skills Map
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          ALGA — focused SAT practice that actually compounds.
        </h1>

        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          Not a fake “AI score predictor”. ALGA is a calm, serious SAT system:
          12-question practice sets, spaced review of mistakes, and a skills map that tells you exactly what to fix next.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/today"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            Open the app
          </Link>

          <Link
            href="/practice?subject=Reading"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-50 transition"
          >
            Try a 12Q practice set
          </Link>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          For KBTU students first. We’re shipping weekly updates and improving question quality continuously.
        </div>
      </div>

      {/* WHAT YOU GET */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-semibold">Practice (12Q)</div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Short sessions that you can finish. No “infinite grind” — just clean sets with clear feedback.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-semibold">Recovery Review</div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Spaced repetition. Mistakes return when they should — so weak areas stop sticking around forever.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-semibold">Skills Map</div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Subskill-level mastery view. See your weakest skills and jump straight into practice or lessons.
          </p>
        </div>
      </div>

      {/* ABOUT / WHY */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-semibold tracking-tight">About</h2>

        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          ALGA is being built for students who want a modern SAT system without fake analytics and inflated claims.
          We keep the product honest: accuracy, practice signals, and actionable next steps — not “predicted SAT”.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-600">Why it works</div>
            <div className="mt-1 text-sm text-gray-700 leading-relaxed">
              Consistency beats intensity. ALGA forces small sessions, tracks weak subskills, and brings mistakes back
              using review scheduling.
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-600">What’s next</div>
            <div className="mt-1 text-sm text-gray-700 leading-relaxed">
              Better question sourcing, more lessons, deeper skill breakdown, and a cleaner web/mobile combined platform.
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="underline text-sm text-gray-700 hover:text-black" href="/skills">
            Explore skills map
          </Link>
          <Link className="underline text-sm text-gray-700 hover:text-black" href="/leagues">
            Open weekly leagues
          </Link>
          <Link className="underline text-sm text-gray-700 hover:text-black" href="/profile">
            Set your target & exam date
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-6 pb-4 text-xs text-gray-500">
        © {new Date().getFullYear()} ALGA. Built by students, for students.
      </div>
    </main>
  );
}