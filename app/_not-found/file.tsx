export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          This page doesn’t exist. Go back to Today and continue practice.
        </p>

        <div className="mt-6 grid gap-3">
          <a
            className="inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
            href="/today"
          >
            Go to Today
          </a>
          <a
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-50 transition"
            href="/practice?subject=Reading"
          >
            Start Practice (12Q)
          </a>
        </div>
      </div>
    </main>
  );
}