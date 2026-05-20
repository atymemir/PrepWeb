'use client';

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Tab = { href: string; label: string; match: string };

const tabs: Tab[] = [
  { href: "/today", label: "Today", match: "/today" },
  { href: "/practice?subject=Reading", label: "Practice", match: "/practice" },
  { href: "/review", label: "Review", match: "/review" },
  { href: "/skills", label: "Skills", match: "/skills" },
  { href: "/leagues", label: "Leagues", match: "/leagues" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const sp = useSearchParams(); // чтобы сохранить subject при желании
  const subject = sp.get("subject");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="grid grid-cols-5 gap-2">
          {tabs.map((t) => {
            const active = pathname === t.match;
            const href =
              t.match === "/practice" && subject
                ? `/practice?subject=${encodeURIComponent(subject)}`
                : t.href;

            return (
              <Link
                key={t.match}
                href={href}
                className={[
                  "rounded-xl px-2 py-2 text-center text-sm font-semibold transition",
                  active
                    ? "border border-gray-300 bg-gray-50 text-black"
                    : "text-gray-600 hover:bg-gray-50 hover:text-black",
                ].join(" ")}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}