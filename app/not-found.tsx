import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          This page doesn’t exist, or the route has changed.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Back to home
          </Link>

          <Link
            href="/today"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-50"
          >
            Open app
          </Link>
        </div>
      </div>
    </main>
  );
}