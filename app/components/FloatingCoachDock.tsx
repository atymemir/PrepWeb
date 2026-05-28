'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { coachMessagesForPath } from "@/app/lib/studentState";
import { useStudentState } from "@/app/lib/useStudentState";

type FloatingCoachDockProps = {
  compact?: boolean;
};

function toneClass(tone: "neutral" | "accent" | "danger" | "success"): string {
  if (tone === "danger") return "border-[#f5b8c4] bg-[#fff2f5] text-[#8f1d35]";
  if (tone === "success") return "border-[#9de0bb] bg-[#ebfdf2] text-[#0f8a4e]";
  if (tone === "accent") return "border-[#c7dbff] bg-[#f2f7ff] text-[#0e1b34]";
  return "border-gray-200 bg-white text-gray-700";
}

function routeLabel(pathname: string): string {
  if (pathname.startsWith("/today")) return "Today mission";
  if (pathname.startsWith("/practice")) return "Practice guidance";
  if (pathname.startsWith("/review")) return "Review guidance";
  if (pathname.startsWith("/skills")) return "Skills guidance";
  if (pathname.startsWith("/history")) return "History guidance";
  if (pathname.startsWith("/lesson") || pathname.startsWith("/lessons")) return "Lesson bridge";
  if (pathname.startsWith("/leagues")) return "Community proof";
  return "Coach guidance";
}

export default function FloatingCoachDock({ compact = false }: FloatingCoachDockProps) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const { state, loading } = useStudentState({ dueLimit: 60, historyLimit: 48 });

  const messages = useMemo(() => {
    if (!state) return [];
    return coachMessagesForPath(pathname, state);
  }, [pathname, state]);

  const primaryAction = state?.recommendedAction;

  if (!state && loading) {
    return (
      <div className="fixed bottom-20 right-4 z-40 md:bottom-7 md:right-6">
        <button
          type="button"
          className="rounded-full border border-[#c7dbff] bg-white/95 px-4 py-3 text-xs font-semibold text-[#0e1b34] shadow-lg"
        >
          Coach syncing…
        </button>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-7 md:right-6">
      {open && (
        <section
          className={[
            "mb-3 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-[#c7dbff] bg-white/95 shadow-2xl backdrop-blur",
            compact ? "p-3" : "p-4",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#004aad]">{routeLabel(pathname)}</div>
              <div className="mt-1 text-sm font-semibold text-[#0f172a]">{primaryAction?.title ?? "Keep the loop tight"}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:text-black"
            >
              Hide
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {messages.slice(0, 3).map((message) => (
              <div key={message.id} className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${toneClass(message.tone)}`}>
                {message.text}
                {message.actionHref && message.actionLabel && (
                  <div className="mt-2">
                    <Link href={message.actionHref} className="text-[11px] font-semibold underline">
                      {message.actionLabel}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {primaryAction ? (
              <Link
                href={primaryAction.primaryHref}
                className="inline-flex items-center justify-center rounded-lg border border-[#0e1b34] bg-[#0e1b34] px-3 py-2 text-xs font-semibold text-white"
              >
                {primaryAction.primaryLabel}
              </Link>
            ) : (
              <Link
                href="/today"
                className="inline-flex items-center justify-center rounded-lg border border-[#0e1b34] bg-[#0e1b34] px-3 py-2 text-xs font-semibold text-white"
              >
                Back to Today
              </Link>
            )}
            <Link
              href="/coach"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-[#0f172a]"
            >
              Open Coach page
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
              Debt {state.reviewDebt.dueCount}
            </span>
            {state.weakestSkill && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                Weak {state.weakestSkill.subskill}
              </span>
            )}
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
              Mode {state.recommendedPracticeMode}
            </span>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group inline-flex items-center gap-2 rounded-full border border-[#0e1b34] bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white shadow-xl"
      >
        <span>Coach</span>
        <span className="rounded-full border border-white/40 bg-white/10 px-2 py-0.5 text-[11px]">
          {state.reviewDebt.dueCount > 0 ? `${state.reviewDebt.dueCount} due` : "ready"}
        </span>
      </button>
    </div>
  );
}
