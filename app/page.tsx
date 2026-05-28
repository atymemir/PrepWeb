import Link from "next/link";

function WordmarkHero() {
  return (
    <div
      className="inline-flex items-end"
      style={{
        fontFamily: "Sora, Manrope, ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "-0.1em",
        lineHeight: 1,
      }}
    >
      <span className="text-[2.7rem] font-extrabold text-white sm:text-[3.4rem]">alg</span>
      <span
        className="relative inline-block text-[2rem] font-extrabold text-[#9fc7ff] sm:text-[2.5rem]"
        style={{ transform: "translateY(0.33em)" }}
      >
        a
      </span>
    </div>
  );
}

function LoopCard({
  step,
  title,
  note,
}: {
  step: string;
  title: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">{step}</div>
      <div className="mt-2 text-base font-semibold text-[#0f172a]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-gray-600">{note}</div>
    </div>
  );
}

function TierCard({
  title,
  price,
  note,
}: {
  title: string;
  price: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{title}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-[#0f172a]">{price}</div>
      <div className="mt-2 text-sm leading-relaxed text-gray-600">{note}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="ink-surface overflow-hidden rounded-[32px] border border-[#22345e] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              SAT Study Operating System
            </div>

            <div className="mt-5">
              <WordmarkHero />
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Serious SAT execution, with clear next actions.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#d2dbec] sm:text-base">
              Practice creates signal. Review clears debt. Skills and lessons route repair. Coach and history keep the loop honest.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#edf5ff]"
              >
                Start free
              </Link>

              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-[#5a719f] bg-white/5 px-5 py-3 text-sm font-semibold text-[#d8e4fb] transition hover:border-[#7d9acf] hover:bg-white/10"
              >
                How it works
              </Link>

              <Link
                href="/today"
                className="inline-flex items-center justify-center rounded-xl border border-[#5a719f] bg-white/5 px-5 py-3 text-sm font-semibold text-[#d8e4fb] transition hover:border-[#7d9acf] hover:bg-white/10"
              >
                Open app
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Core loop</div>
              <div className="mt-2 text-lg font-semibold text-white">Today → Practice → Review → Skills → Coach</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Execution depth</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                Session history, replay/revise routes, and exam shell realism where testing authenticity matters.
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Tiered shell</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                Free is real. Pro and Ultimate unlock deeper execution, analysis, and strategist throughput.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">First session path</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <LoopCard step="Step 1" title="Run one practice block" note="Start with 12 questions to generate real signal." />
          <LoopCard step="Step 2" title="Clear review debt" note="Recover misses before stacking new volume." />
          <LoopCard step="Step 3" title="Route targeted repair" note="Use skills/history to focus one weak subtopic next." />
        </div>
        <div className="mt-5 grid gap-3 sm:max-w-md sm:grid-cols-2">
          <Link
            href="/login?next=/welcome"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50"
          >
            New user onboarding
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50"
          >
            Product model
          </Link>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Plans</h2>
          <Link href="/pricing" className="text-sm font-semibold text-[#004aad] underline hover:text-[#003b88]">
            Full plan details
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TierCard title="Free" price="$0" note="Core loop + SAT tools + recent history window." />
          <TierCard title="Pro" price="$24/mo" note="Exam shell + deeper replay/revise + AI strategist access." />
          <TierCard title="Ultimate" price="$49/mo" note="Higher AI throughput + deeper long-window trend access." />
        </div>
      </section>
    </main>
  );
}
