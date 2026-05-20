export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PracticeClient from "./PracticeClient";

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6">Loading…</div>}>
      <PracticeClient />
    </Suspense>
  );
}