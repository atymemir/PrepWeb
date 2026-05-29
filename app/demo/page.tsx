import Link from "next/link";
import BrandWordmark from "@/app/components/BrandWordmark";

export default function DemoPage() {
  return (
    <main className="min-h-screen">
      <section className="premium-hero ink-surface overflow-hidden rounded-[32px] border border-[#22345e] p-6 shadow-xl sm:p-8">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-[#bdd5ff]">
          <BrandWordmark compact className="display-font font-bold text-[#bdd5ff]" /> demo mode
        </div>

        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Try alga prep instantly without account setup.
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#d2dbec] sm:text-base">
          Public walkthrough: SAT-style questions, immediate feedback, and a compact finish payoff.
        </p>

        <div className="mt-6 grid gap-3 sm:max-w-xl sm:grid-cols-2">
          <Link
            href="/demo/practice?subject=Reading"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#edf5ff]"
          >
            Try Reading demo
          </Link>

          <Link
            href="/demo/practice?subject=Math"
            className="inline-flex items-center justify-center rounded-xl border border-[#5a719f] bg-white/5 px-4 py-3 text-sm font-semibold text-[#d8e4fb] transition hover:border-[#7d9acf] hover:bg-white/10"
          >
            Try Math demo
          </Link>
        </div>

        <div className="mt-4 text-xs text-[#becde6]">
          Demo is not saved. Review queue, skills map, and coaching unlock after sign-in.
        </div>
      </section>
    </main>
  );
}
