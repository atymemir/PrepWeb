import Link from "next/link";

function LoopTile({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-semibold text-[#0f172a]">{title}</div>
      <div className="mt-2 text-sm text-gray-600">{detail}</div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen">
      <section className="ink-surface overflow-hidden rounded-[32px] border border-[#22345e] shadow-xl">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              Why alga
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              alga is a high-signal SAT operating system.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec] sm:text-base">
              Most prep apps give question volume. alga gives a decision loop: where you are now, what is weak, what to do next, and what payoff you get.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#edf5ff]"
              >
                Start free
              </Link>
              <Link
                href="/login?next=/welcome"
                className="inline-flex items-center justify-center rounded-xl border border-[#5a719f] bg-white/5 px-5 py-3 text-sm font-semibold text-[#d8e4fb] transition hover:border-[#7d9acf] hover:bg-white/10"
              >
                View onboarding flow
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">What problem we solve</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                Students often do random sets without closing mistakes. alga forces clean sequencing: generate signal, recover debt, repair weak zones, verify movement.
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">What you get after signup</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                Today mission command, focused Practice modes, debt-aware Review, mastery-driven Skills/Lessons, movement proof in History, and contextual Coach guidance.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Core loop</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">
          {"Practice -> Review -> Skills/Lessons -> History/Coach"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <LoopTile title="Practice" detail="Generate performance signal with focused blocks." />
          <LoopTile title="Review" detail="Clear due mistakes before adding more volume." />
          <LoopTile title="Skills" detail="See mastery state and movement state clearly." />
          <LoopTile title="Lessons" detail="Use repair playbooks, then retry immediately." />
          <LoopTile title="History + Coach" detail="See proof of movement and get next command." />
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">First 3 clicks (new user)</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <LoopTile title="1. Set target + date" detail="One-minute setup in onboarding." />
          <LoopTile title="2. Run a 12Q block" detail="Creates first reliable weakness signal." />
          <LoopTile title="3. Follow Today command" detail="Route to review debt or weak-topic repair." />
        </div>
        <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center justify-center rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a]"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
