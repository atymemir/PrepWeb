'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";
import { normalizePlanTier, tierDefinition } from "@/app/lib/productTiers";
import BrandWordmark from "@/app/components/BrandWordmark";

type NavItem = {
  href: string;
  label: string;
  match: string;
};

const appPrimaryNav: NavItem[] = [
  { href: "/today", label: "Today", match: "/today" },
  { href: "/practice?subject=Reading", label: "Practice", match: "/practice" },
  { href: "/review", label: "Review", match: "/review" },
  { href: "/skills", label: "Skills", match: "/skills" },
  { href: "/coach", label: "Coach", match: "/coach" },
];

const appSecondaryNav: NavItem[] = [
  { href: "/history", label: "History", match: "/history" },
  { href: "/lessons", label: "Lessons", match: "/lessons" },
  { href: "/leagues", label: "Community", match: "/leagues" },
];

const publicNav: NavItem[] = [
  { href: "/", label: "Product", match: "/" },
  { href: "/how-it-works", label: "How it works", match: "/how-it-works" },
  { href: "/pricing", label: "Plans", match: "/pricing" },
];

function isActivePath(pathname: string, match: string): boolean {
  return match === "/" ? pathname === "/" : pathname.startsWith(match);
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/how-it-works") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/demo")
  );
}

function Wordmark() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <BrandWordmark className="display-font text-base font-bold text-[#0e1b34] sm:text-lg" />
      <span className="hidden rounded-full border border-[#c7dbff] bg-[#eff6ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#004aad] sm:inline-flex">
        Beta
      </span>
    </div>
  );
}

export default function Header() {
  const pathname = usePathname() || "/";
  const publicSurface = isPublicPath(pathname);

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [planLabel, setPlanLabel] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    async function syncPlan(userId: string | null) {
      if (!userId) {
        setPlanLabel(null);
        return;
      }

      try {
        const profileRes = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", userId)
          .single();

        if (!mounted) return;

        if (profileRes.error) {
          setPlanLabel("Free");
          return;
        }

        const tier = tierDefinition(
          normalizePlanTier((profileRes.data as { plan_tier?: string | null })?.plan_tier)
        );
        setPlanLabel(tier.label);
      } catch {
        if (!mounted) return;
        setPlanLabel(null);
      }
    }

    async function bootstrap() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setHasSession(!!data.session);
        await syncPlan(data.session?.user.id ?? null);
      } finally {
        if (mounted) setReady(true);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setReady(true);
      void syncPlan(session?.user.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const usingAppNav = hasSession && !publicSurface;
  const mainNav = usingAppNav ? appPrimaryNav : publicNav;

  const rightAction = useMemo(() => {
    if (!ready) {
      return <div className="h-9 w-24 rounded-xl bg-white/70" aria-hidden="true" />;
    }

    if (hasSession) {
      return (
        <div className="flex items-center gap-2">
          {planLabel && (
            <span className="hidden rounded-full border border-[#d7e5fb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#415677] md:inline-flex">
              {planLabel}
            </span>
          )}
          <Link
            href="/today"
            className="inline-flex items-center justify-center rounded-xl border border-[#0e1b34] bg-[linear-gradient(135deg,#0f1b34,#182d52)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
          >
            Open app
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#1f2d45] hover:border-gray-400"
        >
          Sign in
        </Link>
        <Link
          href="/login?mode=signup"
          className="hidden items-center justify-center rounded-xl border border-[#0e1b34] bg-[linear-gradient(135deg,#0f1b34,#182d52)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 sm:inline-flex"
        >
          Start free
        </Link>
      </div>
    );
  }, [hasSession, planLabel, ready]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[linear-gradient(180deg,rgba(248,251,255,0.94),rgba(244,248,255,0.86))] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/95" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <Link
            href={hasSession ? "/today" : "/"}
            className="accent-sheen inline-flex shrink-0 items-center rounded-xl px-3 py-1.5 shadow-sm"
            aria-label="algₐ prep home"
          >
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {mainNav.map((item) => {
              const active = isActivePath(pathname, item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-semibold transition",
                    active
                      ? "border border-[#0e1b34] bg-[linear-gradient(135deg,#0f1b34,#182d52)] text-white shadow-sm"
                      : "text-[#4b5f7f] hover:bg-white hover:text-[#0e1b34]",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {usingAppNav && (
            <nav className="hidden items-center gap-1 xl:flex">
              {appSecondaryNav.map((item) => {
                const active = isActivePath(pathname, item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      active
                        ? "bg-[#edf4ff] text-[#0e1b34]"
                        : "text-[#63779a] hover:bg-white hover:text-[#0e1b34]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {rightAction}
      </div>

      <div className="border-t border-white/80 lg:hidden">
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5">
          {mainNav.map((item) => {
            const active = isActivePath(pathname, item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "border border-[#0e1b34] bg-[#0e1b34] text-white"
                    : "border border-transparent bg-white/80 text-[#4b5f7f] hover:bg-white hover:text-[#0e1b34]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
