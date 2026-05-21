import { Suspense } from "react";
import DemoPracticeClient from "./DemoPracticeClient";

export default function DemoPracticePage() {
  return (
    <Suspense fallback={<main className="min-h-screen"><div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading demo…</div></main>}>
      <DemoPracticeClient />
    </Suspense>
  );
}