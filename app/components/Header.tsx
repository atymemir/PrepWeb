'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

const navItems = [
  { href: "/today", label: "Today", match: "/today" },
  { href: "/practice?subject=Reading", label: "Practice", match: "/practice" },
  { href: "/review", label: "Review", match: "/review" },
  { href: "/skills", label: "Skills", match: "/skills" },
  { href: "/lessons", label: "Lessons", match: "/lessons" },
  { href: "/coach", label: "Coach", match: "/coach" },
  { href: "/leagues", label: "Community", match: "/leagues" },
];

function isActivePath(pathname: string, match: string) {
  return match === "/" ? pathname === "/" : pathname.startsWith(match);
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-end font-extrabold text-[#004aad]",
        compact ? "text-base" : "text-lg",
      ].join(" ")}
      style={{
        fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "-0.095em",
        lineHeight: 1,
      }}
    >
      <span>alg</span>
      <span className="relative inline-block text-[0.72em]" style={{ transform: "translateY(0.18em)" }}>
        a
      </span>
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    async function bootstrap() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setHasSession(!!data.session);
      } finally {
        if (mounted) setReady(true);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const rightAction = useMemo(() => {
    if (!ready) {
      return <div className="h-9 w-20 shrink-0" aria-hidden="true" />;
    }

    if (hasSession) {
      return (
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/profile"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-black sm:inline-flex"
          >
            Profile
          </Link>

          <Link
            href="/today"
            className="inline-flex items-center justify-center rounded-lg border border-[#c7dbff] bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#004aad] transition hover:bg-[#dfeeff]"
          >
            Open app
          </Link>
        </div>
      );
    }

    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-gray-50"
        >
          Sign in
        </Link>
      </div>
    );
  }, [hasSession, ready]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="shrink-0">
            <Wordmark compact />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.match);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "border border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-black",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {rightAction}
      </div>

      <div className="border-t border-gray-100 lg:hidden">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.match);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "border border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-black",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}

          {hasSession && (
            <Link
              href="/profile"
              className={[
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
                pathname.startsWith("/profile")
                  ? "border border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-black",
              ].join(" ")}
            >
              Profile
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
