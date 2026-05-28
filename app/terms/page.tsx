import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
          ALGA
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: May 28, 2026</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700">
          <p>
            This is a temporary terms of service placeholder for ALGA Prep. A
            full legal version will be published with complete terms, billing
            details, acceptable use, disclaimers, and limitation of liability.
          </p>
          <p>
            ALGA is an educational SAT preparation product. It provides practice
            and review workflows, but does not guarantee specific exam outcomes
            or admissions results.
          </p>
          <p>
            By using the service, you agree to use the platform lawfully and not
            to abuse, reverse-engineer, or disrupt product infrastructure.
          </p>
          <p>
            For legal or account questions, contact:
            <span className="ml-1 font-semibold">support@algaprep.tech</span>
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
