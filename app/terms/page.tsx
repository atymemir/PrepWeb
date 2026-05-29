import Link from "next/link";
import BrandWordmark from "@/app/components/BrandWordmark";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 md:p-10">
        <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
          <BrandWordmark />
        </div>
        
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Terms of Service & Privacy
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: May 28, 2026</p>

        <div className="mt-8 space-y-8 text-base leading-relaxed text-gray-700">
          
          {/* General Terms Introduction */}
          <section>
            <p>
              This is a temporary terms of service placeholder for algₐ prep. A
              full legal version will be published with complete terms, billing
              details, acceptable use, disclaimers, and limitation of liability.
            </p>
          </section>

          {/* Google API Services Disclosure - Highlighted for Reviewers */}
          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Google API Services Usage Disclosure
            </h2>
            <p className="mb-4 text-sm sm:text-base">
              AlgaPrep's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <div className="space-y-4 text-sm sm:text-base">
              <div>
                <h3 className="font-semibold text-gray-900">Data Accessed:</h3>
                <p className="mt-1 text-gray-600">
                  If you choose to log in using Google, our application accesses your primary Google account email address and basic profile information (name and profile picture) via the standard Google OAuth login scopes.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Data Usage:</h3>
                <p className="mt-1 text-gray-600">
                  We use this data strictly to create and authenticate your AlgaPrep user account, personalize your experience within the app, and communicate with you regarding your account. We do not sell this data, and we do not share it with third parties for marketing purposes.
                </p>
              </div>
            </div>
          </section>

          {/* Service Usage Rules */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Platform Usage</h2>
            <p>
              algₐ prep is an educational SAT preparation product. It provides practice
              and review workflows, but does not guarantee specific exam outcomes
              or admissions results.
            </p>
            <p>
              By using the service, you agree to use the platform lawfully and not
              to abuse, reverse-engineer, or disrupt product infrastructure.
            </p>
          </section>

          {/* Contact Section */}
          <section className="border-t border-gray-200 pt-6">
            <p>
              For legal or account questions, contact:{" "}
              <a 
                href="mailto:support@algaprep.tech" 
                className="font-semibold text-blue-600 hover:underline"
              >
                support@algaprep.tech
              </a>
            </p>
          </section>
        </div>

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}