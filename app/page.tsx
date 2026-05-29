import Link from "next/link";
import BrandWordmark from "@/app/components/BrandWordmark";
import VisualAnchorPanel from "@/app/components/VisualAnchorPanel";

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
    <div className="rounded-2xl border border-gray-200 bg-[linear-gradient(145deg,#ffffff,#f8fbff)] p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">{step}</div>
      <div className="mt-2 text-base font-semibold text-[#0f172a]">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-[#4d607f]">{note}</div>
    </div>
  );
}

function ProofChip({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a9c8ff]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-[#c3d2ea]">{note}</div>
    </div>
  );
}

function DifferenceCard({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="text-base font-semibold text-[#0f172a]">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-[#4d607f]">{note}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="premium-hero ink-surface overflow-hidden rounded-[32px] border border-[#22345e] shadow-xl">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#486399] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              <BrandWordmark compact className="display-font font-bold text-[#bdd5ff]" />
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Turn every SAT/AP block into a score decision.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#d2dbec] sm:text-base">
              alga prep converts finished work into four outputs: what is weak, what changed, what to do next, and what payoff you get.
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
                See how it works
              </Link>
            </div>

            <div className="mt-6 grid gap-2 sm:max-w-xl sm:grid-cols-3">
              <ProofChip label="Clarity" value="One mission" note="No random set browsing" />
              <ProofChip label="Repair" value="One weak topic" note="Targeted lesson and retry" />
              <ProofChip label="Payoff" value="Measured movement" note="Before and after proof" />
            </div>
          </div>

          <VisualAnchorPanel
            variant="onboarding"
            eyebrow="After one finished block"
            title="You get a real next move"
            subtitle="Signal stays concrete: weakness, debt pressure, and exact route."
            metrics={[
              {
                label: "Weak signal",
                value: "Current score leak by subskill",
                note: "No vague confidence labels",
                tone: "accent",
              },
              {
                label: "Repair target",
                value: "Highest-priority topic",
                note: "Lesson + focused retry bridge",
                tone: "neutral",
              },
              {
                label: "Payoff proof",
                value: "Before/after movement",
                note: "Comparable block deltas",
                tone: "success",
              },
            ]}
            footer="Execution quality over motivation theater."
          />
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">How it works</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">
          Diagnostic, plan, practice, review, improvement
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-5">
          <LoopCard step="Step 1" title="Start diagnostic" note="Run a short set to establish your current level." />
          <LoopCard step="Step 2" title="Get your plan" note="Today shows what to attack now and why." />
          <LoopCard step="Step 3" title="Practice" note="Run a focused block with clear completion payoff." />
          <LoopCard step="Step 4" title="Review" note="Recover mistakes before you add more volume." />
          <LoopCard step="Step 5" title="Improve" note="Track movement and repeat what works." />
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Why students stick with it</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <DifferenceCard
            title="Not a random question bank"
            note="You always get a precise next move instead of browsing endless sets."
          />
          <DifferenceCard
            title="Not generic AI fluff"
            note="Recommendations are tied to your weak skills, review debt, and movement evidence."
          />
          <DifferenceCard
            title="Built for repeatable gains"
            note="Open daily, get mission clarity in seconds, execute, and verify progress."
          />
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-[#c7dbff] bg-[#f6faff] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f172a]">Launch your first loop</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#465a7b]">
          No fake promises. Just a high-clarity system that sharpens with every completed block.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center justify-center rounded-xl border border-[#0e1b34] bg-[#0e1b34] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a]"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
