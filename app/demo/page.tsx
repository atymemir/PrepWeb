import Link from "next/link";

export default function DemoPage() {
  return (
    <main className="min-h-screen">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
          Demo Mode
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Try ALGA without creating an account.
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-600 sm:text-base">
          This is a lightweight public walkthrough: a small set of SAT-style questions,
          instant feedback, and a session summary. No login, no saved progress, no friction.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/demo/practice?subject=Reading"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Try Reading demo
          </Link>

          <Link
            href="/demo/practice?subject=Math"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-50"
          >
            Try Math demo
          </Link>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Demo mode is public. Real progress, review scheduling, skills, and community require sign-in.
        </div>
      </section>
    </main>
  );
}
