'use client';

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";
import FloatingCoachDock from "./FloatingCoachDock";
import SiteFooter from "./SiteFooter";

const STUDY_PREFIXES = [
  "/today",
  "/practice",
  "/review",
  "/skills",
  "/lessons",
  "/lesson",
  "/coach",
  "/history",
  "/profile",
  "/leagues",
];

function isStudyPath(pathname: string): boolean {
  return STUDY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isCoachDockFriendlyPath(pathname: string): boolean {
  return (
    pathname.startsWith("/today") ||
    pathname.startsWith("/skills") ||
    pathname.startsWith("/coach") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/lessons") ||
    pathname.startsWith("/lesson")
  );
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const studySurface = useMemo(() => isStudyPath(pathname), [pathname]);
  const coachDockSurface = useMemo(() => isCoachDockFriendlyPath(pathname), [pathname]);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(!!data.session);
    }

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const showPublicFooter = !studySurface || !hasSession;

  return (
    <>
      <main
        className={
          studySurface
            ? "app-canvas mx-auto max-w-6xl px-4 pb-24 pt-5 md:pb-10 md:pt-7"
            : "mx-auto max-w-6xl px-4 pb-12 pt-5 md:pt-8"
        }
      >
        {children}
      </main>

      {showPublicFooter ? <SiteFooter /> : null}

      {studySurface && hasSession && coachDockSurface ? <FloatingCoachDock /> : null}
    </>
  );
}
