'use client';

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: string;
};

const tabs: Tab[] = [
  { href: "/today", label: "Today", match: "/today" },
  { href: "/practice?subject=Reading", label: "Practice", match: "/practice" },
  { href: "/review", label: "Review", match: "/review" },
  { href: "/skills", label: "Skills", match: "/skills" },
  { href: "/leagues", label: "Community", match: "/leagues" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSubject = searchParams.get("subject") || "Reading";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="grid grid-cols-5 gap-2">
          {tabs.map((tab) => {
            const active = pathname === tab.match;

            const href =
              tab.match === "/practice"
                ? `/practice?subject=${encodeURIComponent(currentSubject)}`
                : tab.href;

            return (
              <Link
                key={tab.match}
                href={href}
                className={[
                  "rounded-xl px-2 py-2 text-center text-sm font-semibold transition",
                  active
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-black",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
