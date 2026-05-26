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
  title,
  note,
  href,
}: {
  title: string;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#bdd7ff] hover:shadow-md"
    >
      <div className="text-base font-semibold text-[#0f172a]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-gray-600">{note}</div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="ink-surface overflow-hidden rounded-[32px] border border-[#22345e] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              Digital SAT training system
            </div>

            <div className="mt-5">
              <WordmarkHero />
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Serious SAT execution, not dashboard theater.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#d2dbec] sm:text-base">
              One next action at a time: practice for signal, review for recovery, skills for diagnosis,
              lessons for repair, and coach for route control.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/today"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#edf5ff]"
              >
                Open command center
              </Link>

              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-xl border border-[#5a719f] bg-white/5 px-5 py-3 text-sm font-semibold text-[#d8e4fb] transition hover:border-[#7d9acf] hover:bg-white/10"
              >
                Try the demo
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Core loop</div>
              <div className="mt-2 text-lg font-semibold text-white">Practice → Review → Skills → Lessons → Coach</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Session design</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                Short, repeatable blocks with durable engagement tracking and recovery pressure.
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">SAT tools layer</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                Math tools are available as an in-session layer, with future-ready Desmos integration.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <LoopCard title="Today" note="Start exactly where your mission is." href="/today" />
        <LoopCard title="Practice" note="Generate fresh signal under pressure." href="/practice?subject=Reading" />
        <LoopCard title="Review" note="Clear active debt before more volume." href="/review" />
        <LoopCard title="History" note="Reopen outcomes and launch targeted retries." href="/history" />
        <LoopCard title="Coach" note="Get strategist routing from real data." href="/coach" />
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Built for durable momentum</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              The goal is not to feel busy. The goal is to make each session materially improve decision quality for
              the next one.
            </p>
          </div>
          <div className="rounded-2xl border border-[#c8ddff] bg-[#f3f8ff] p-4 text-sm leading-relaxed text-gray-700">
            No fake exact score promises. No noisy gamification. No broad advice loops. Just evidence, recovery, and
            precise next actions.
          </div>
        </div>
      </section>
    </main>
  );
}
