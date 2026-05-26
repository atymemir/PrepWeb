'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";
import { getDurableEngagementSnapshot } from "@/app/lib/engagementDurable";

const navItems = [
  { href: "/today", label: "Today", match: "/today" },
  { href: "/practice?subject=Reading", label: "Practice", match: "/practice" },
  { href: "/review", label: "Review", match: "/review" },
  { href: "/skills", label: "Skills", match: "/skills" },
  { href: "/lessons", label: "Lessons", match: "/lessons" },
  { href: "/coach", label: "Coach", match: "/coach" },
  { href: "/history", label: "History", match: "/history" },
  { href: "/leagues", label: "Community", match: "/leagues" },
];

function isActivePath(pathname: string, match: string) {
  return match === "/" ? pathname === "/" : pathname.startsWith(match);
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-end font-extrabold text-[#0e1b34]",
        compact ? "text-base" : "text-lg",
      ].join(" ")}
      style={{
        fontFamily: "Sora, Manrope, ui-sans-serif, system-ui, sans-serif",
        letterSpacing: "-0.1em",
        lineHeight: 1,
      }}
    >
      <span className="text-[#0e1b34]">alg</span>
      <span className="relative inline-block text-[0.72em] text-[#004aad]" style={{ transform: "translateY(0.18em)" }}>
        a
      </span>
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [ready, setReady] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [streakLabel, setStreakLabel] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    async function syncStatus(userId: string | null) {
      if (!userId) {
        setStatusLabel(null);
        setStreakLabel(null);
        return;
      }

      try {
        const snapshot = await getDurableEngagementSnapshot();
        if (!mounted) return;
        setStatusLabel(`${snapshot.status.division.label} L${snapshot.status.level}`);
        setStreakLabel(`${snapshot.identity.streakDays}d streak`);
      } catch {
        if (!mounted) return;
        setStatusLabel(null);
        setStreakLabel(null);
      }
    }

    async function bootstrap() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setHasSession(!!data.session);
        await syncStatus(data.session?.user.id ?? null);
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
      void syncStatus(session?.user.id ?? null);
    });

    function onEngagementUpdated(event: Event) {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId) return;
      void syncStatus(detail.userId);
    }

    window.addEventListener("alga-engagement-updated", onEngagementUpdated);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("alga-engagement-updated", onEngagementUpdated);
    };
  }, []);

  const rightAction = useMemo(() => {
    if (!ready) {
      return <div className="h-9 w-20 shrink-0" aria-hidden="true" />;
    }

    if (hasSession) {
      return (
        <div className="flex shrink-0 items-center gap-2">
          {statusLabel && streakLabel && (
            <div className="hidden rounded-xl border border-[#b9d6ff] bg-[#eef5ff] px-3 py-2 text-xs font-semibold text-[#004aad] shadow-sm xl:block">
              {statusLabel} • {streakLabel}
            </div>
          )}

          <Link
            href="/profile"
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-black sm:inline-flex"
          >
            Profile
          </Link>

          <Link
            href="/today"
            className="inline-flex items-center justify-center rounded-xl border border-[#0e1b34] bg-[#0e1b34] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#192948]"
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
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-gray-50"
        >
          Sign in
        </Link>
      </div>
    );
  }, [hasSession, ready, statusLabel, streakLabel]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-[rgba(245,248,253,0.86)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="shrink-0 rounded-xl border border-white/80 bg-white/80 px-3 py-1.5 shadow-sm"
          >
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
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "border border-[#0e1b34] bg-[#0e1b34] text-white shadow-sm"
                      : "text-gray-600 hover:bg-white hover:text-black",
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

      <div className="border-t border-gray-200/70 lg:hidden">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.match);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "border border-[#0e1b34] bg-[#0e1b34] text-white"
                    : "border border-transparent bg-white/75 text-gray-600 hover:bg-white hover:text-black",
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
                "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition",
                pathname.startsWith("/profile")
                  ? "border border-[#0e1b34] bg-[#0e1b34] text-white"
                  : "border border-transparent bg-white/75 text-gray-600 hover:bg-white hover:text-black",
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
