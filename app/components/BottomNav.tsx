'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today" },
  { href: "/practice?subject=Reading", label: "Practice" },
  { href: "/review", label: "Review" },
  { href: "/skills", label: "Skills" },
  { href: "/leagues", label: "Leagues" },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="grid grid-cols-5 gap-2">
          {tabs.map(t => {
            const active = path === t.href.split("?")[0];
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  "rounded-xl px-2 py-2 text-center text-sm font-semibold transition",
                  active ? "border border-gray-300 bg-gray-50 text-black" : "text-gray-600 hover:bg-gray-50"
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