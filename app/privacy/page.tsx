import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
          ALGA
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-black">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: May 28, 2026</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700">
          <p>
            This is a temporary privacy policy placeholder for ALGA Prep. We are
            preparing a full legal version with complete details about data
            collection, usage, retention, and user rights.
          </p>
          <p>
            At a high level, ALGA may process account information, study session
            data, and app analytics to provide SAT prep features such as
            practice, review, progress history, and coaching guidance.
          </p>
          <p>
            If you have privacy questions or need account/data support, contact:
            <span className="ml-1 font-semibold">support@algaprep.tech</span>
          </p>
          <p>
            By continuing to use the service, you acknowledge this temporary
            notice until the full Privacy Policy is published.
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
