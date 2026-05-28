'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

function isStudyPath(pathname: string): boolean {
  return (
    pathname.startsWith("/today") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/skills") ||
    pathname.startsWith("/lessons") ||
    pathname.startsWith("/lesson") ||
    pathname.startsWith("/coach") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/leagues")
  );
}

export default function SiteFooter() {
  const pathname = usePathname() || "/";
  const study = isStudyPath(pathname);

  return (
    <footer className="mt-8 border-t border-gray-200/80">
      <div
        className={[
          "mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center",
          study ? "text-gray-600" : "text-gray-700",
        ].join(" ")}
      >
        <div className="text-sm">
          <div className="font-semibold text-[#0e1b34]">ALGA Prep</div>
          <div className="mt-1 text-xs">
            Practice {"->"} Review {"->"} Skills/Lessons {"->"} History/Coach
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/privacy"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-black"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-black"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
