import Link from "next/link";
import BrandWordmark from "@/app/components/BrandWordmark";
import VisualAnchorPanel from "@/app/components/VisualAnchorPanel";

function FlowCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-[linear-gradient(145deg,#ffffff,#f8fbff)] p-4 shadow-sm">
      <div className="text-sm font-semibold text-[#0f172a]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-[#4d607f]">{detail}</div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen">
      <section className="premium-hero ink-surface overflow-hidden rounded-[32px] border border-[#22345e] shadow-xl">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              <BrandWordmark compact className="display-font font-bold text-[#bdd5ff]" />  model
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Every finished block should end with a clear decision.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec] sm:text-base">
              alga prep reads performance pressure, ranks weak signals, and routes you into the next highest-impact action.
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
                Start onboarding
              </Link>
            </div>
          </div>

          <VisualAnchorPanel
            variant="onboarding"
            eyebrow="Execution map"
            title="Command -> evidence -> action"
            subtitle="Every completed block should convert into one decisive next move."
            metrics={[
              {
                label: "What changes",
                value: "No guessing route",
                note: "One mission, one next block",
                tone: "accent",
              },
              {
                label: "What stays honest",
                value: "Mistakes stay visible",
                note: "Repair before new volume",
                tone: "danger",
              },
              {
                label: "What you gain",
                value: "Stability faster",
                note: "Higher signal, lower waste",
                tone: "success",
              },
            ]}
            footer="Productive loops beat motivational noise."
          />
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Core loop</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">
          Diagnostic, plan, practice, review, improvement
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <FlowCard title="Diagnostic" detail="A short baseline block exposes first weak signals." />
          <FlowCard title="Plan" detail="Today selects the next action with top expected payoff." />
          <FlowCard title="Practice" detail="Focused execution generates clean comparable evidence." />
          <FlowCard title="Review" detail="Debt recovery clears old misses before new volume." />
          <FlowCard title="Improve" detail="Movement proof confirms what actually stabilized." />
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">First day checklist</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FlowCard title="1. Set your target" detail="Choose exam type, target, and daily workload." />
          <FlowCard title="2. Finish one block" detail="Complete a short session to create real signal." />
          <FlowCard title="3. Follow Today" detail="Execute the top mission instead of browsing." />
        </div>
      </section>
    </main>
  );
}
