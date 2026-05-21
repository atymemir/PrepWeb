import Link from "next/link";

function WordmarkHero() {
  return (
    <div
      className="inline-flex items-end text-[#004aad]"
      style={{
        fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "-0.095em",
        lineHeight: 1,
      }}
    >
      <span className="text-[2.4rem] font-extrabold sm:text-[3rem]">alg</span>
      <span
        className="relative inline-block text-[1.7rem] font-extrabold sm:text-[2.1rem]"
        style={{ transform: "translateY(0.32em)" }}
      >
        a
      </span>
    </div>
  );
}

function FeatureCard({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#d9e7ff] hover:bg-[#fbfdff]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
        {eyebrow}
      </div>
      <div className="mt-2 text-base font-semibold text-black">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
    </div>
  );
}

function StatCard({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5",
        accent ? "border-[#c7dbff] bg-[#f6faff]" : "border-gray-200 bg-white",
      ].join(" ")}
    >
      <div className={`text-2xl font-semibold tracking-tight ${accent ? "text-[#004aad]" : "text-black"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-600">{label}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#c7dbff] bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#004aad]">
              Digital SAT • disciplined training system
            </div>

            <div className="mt-5">
              <WordmarkHero />
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-black sm:text-4xl lg:text-5xl">
              A sharper SAT workflow built around next actions, recovery, and real weak-skill repair.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
              algₐ is not built to impress with noise. It is built to tell a student what to do now,
              what went wrong, what deserves repair, and where to push next.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/today"
                className="inline-flex items-center justify-center rounded-xl bg-[#004aad] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88]"
              >
                Open the app
              </Link>

              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-50"
              >
                Try the demo
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Built for students who want a calmer system and cleaner decisions.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard value="12Q" label="Short practice sessions by default" accent />
            <StatCard value="1 loop" label="Practice → Review → Skills → Lessons" />
            <StatCard value="0 hype" label="No fake score theatrics" />
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gradient-to-r from-[#fbfdff] via-white to-white px-6 py-4 text-xs text-gray-500 sm:px-8">
          Stronger than generic prep dashboards because the workflow is tighter: fewer wasted sessions, clearer recovery, more honest signal.
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <FeatureCard
          eyebrow="Practice"
          title="Short sessions that stay usable"
          text="You do focused 12-question sets instead of getting buried under bloated, vague prep flows."
        />
        <FeatureCard
          eyebrow="Review"
          title="Mistakes return with intent"
          text="Wrong answers come back through recovery, so weak areas stop leaking points quietly."
        />
        <FeatureCard
          eyebrow="Skills"
          title="Weakness becomes actionable"
          text="The skills map shows what is unstable, what needs more evidence, and what to repair next."
        />
      </section>

      <section className="mt-4 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-black">Why algₐ feels different</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Most prep tools compete on volume, dashboards, or AI branding. algₐ is built around execution:
              one best next action, clean review pressure, visible weak zones, and repair that actually closes the loop.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-[#d9e7ff] bg-[#f8fbff] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                What we optimize for
              </div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">
                Better training decisions, lower friction, faster recovery from mistakes, and a product
                students can use daily without getting mentally tired by the interface.
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                What we avoid
              </div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">
                Fake score predictions, noisy gamification, inflated analytics, and visual clutter pretending to be intelligence.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/today"
          className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#d9e7ff] hover:bg-[#fbfdff]"
        >
          <div className="text-sm font-semibold text-black">Today</div>
          <div className="mt-2 text-sm leading-relaxed text-gray-600">
            Open the command center and see the next best action.
          </div>
        </Link>

        <Link
          href="/review"
          className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#d9e7ff] hover:bg-[#fbfdff]"
        >
          <div className="text-sm font-semibold text-black">Review</div>
          <div className="mt-2 text-sm leading-relaxed text-gray-600">
            Clear due mistakes before they harden into habits.
          </div>
        </Link>

        <Link
          href="/skills"
          className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#d9e7ff] hover:bg-[#fbfdff]"
        >
          <div className="text-sm font-semibold text-black">Skills</div>
          <div className="mt-2 text-sm leading-relaxed text-gray-600">
            Inspect weak subskills and jump directly into targeted repair.
          </div>
        </Link>

        <Link
          href="/lessons"
          className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#d9e7ff] hover:bg-[#fbfdff]"
        >
          <div className="text-sm font-semibold text-black">Lessons</div>
          <div className="mt-2 text-sm leading-relaxed text-gray-600">
            Read the concept fast, then move directly into practice.
          </div>
        </Link>

        <Link
          href="/coach"
          className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#d9e7ff] hover:bg-[#fbfdff]"
        >
          <div className="text-sm font-semibold text-black">Coach</div>
          <div className="mt-2 text-sm leading-relaxed text-gray-600">
            See what is actually going wrong and what your next route should be.
          </div>
        </Link>
      </section>

      <section className="mt-6 pb-4 text-xs text-gray-500">
        © {new Date().getFullYear()} algₐ. Built with product discipline, not noise.
      </section>
    </main>
  );
}