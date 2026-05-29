'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  coachMessagesForPath,
  routeFromPathname,
  type ContextualCoachMessage,
  type StudentState,
} from "@/app/lib/studentState";
import { focusedPracticeHref } from "@/app/lib/mastery";
import { useStudentState } from "@/app/lib/useStudentState";

type FloatingCoachDockProps = {
  compact?: boolean;
};

function toneClass(tone: "neutral" | "accent" | "danger" | "success"): string {
  if (tone === "danger") return "border-[#7b3f4d] bg-[#412432] text-[#ffd6df]";
  if (tone === "success") return "border-[#3f6d57] bg-[#1f3b31] text-[#d6ffe8]";
  if (tone === "accent") return "border-[#3c5f93] bg-[#1f3150] text-[#d8e8ff]";
  return "border-[#425a84] bg-[#1a2b48] text-[#d4e1f8]";
}

function routeLabel(pathname: string): string {
  const route = routeFromPathname(pathname);
  if (route === "today") return "Today mission";
  if (route === "practice") return "Practice guidance";
  if (route === "review") return "Review guidance";
  if (route === "skills") return "Skills guidance";
  if (route === "history") return "History guidance";
  if (route === "lessons") return "Lesson bridge";
  if (route === "community") return "Community";
  return "Coach guidance";
}

function routeAwareMessage(args: {
  pathname: string;
  state: StudentState;
  modeParam: string | null;
  subskillParam: string | null;
  revisitParam: boolean;
}): ContextualCoachMessage | null {
  const { pathname, state, modeParam, subskillParam, revisitParam } = args;
  const route = routeFromPathname(pathname);

  if (route === "practice") {
    if (modeParam === "exam" && state.reviewDebt.dueCount > 0) {
      return {
        id: "route-practice-exam-debt",
        tone: "danger",
        text: "Exam mode is active, but review items are still waiting. Finish this block, then review before another test.",
        actionHref: "/review",
        actionLabel: "Start review",
      };
    }

    if (subskillParam && state.weakestSkill && state.weakestSkill.subskill === subskillParam) {
      return {
        id: "route-practice-targeted-weakest",
        tone: "accent",
        text: `You are training the live weakest skill (${subskillParam}). Complete this block, then verify movement in History.`,
        actionHref: "/history",
        actionLabel: "Check movement",
      };
    }

    if (revisitParam) {
      return {
        id: "route-practice-revisit",
        tone: "neutral",
        text: "Revisit mode should close one weak loop, not become random replay. Finish and route immediately.",
        actionHref: state.recommendedAction.primaryHref,
        actionLabel: state.recommendedAction.primaryLabel,
      };
    }
  }

  if (route === "review") {
    if (state.reviewDebt.dueCount > 0) {
      return {
        id: "route-review-active",
        tone: "danger",
        text: `${state.reviewDebt.dueCount} review items remain. Keep this block focused until the queue drops.`,
        actionHref: "/review",
        actionLabel: "Continue review",
      };
    }
    if (state.weakestSkill) {
      return {
        id: "route-review-clear",
        tone: "success",
        text: `Review queue is clear. Route straight into ${state.weakestSkill.subskill} before broad volume.`,
        actionHref: focusedPracticeHref(
          state.weakestSkill.subject,
          state.weakestSkill.subskill
        ),
        actionLabel: "Run weak-topic practice",
      };
    }
  }

  if (route === "history") {
    if (state.recentMovement.biggestDrop) {
      return {
        id: "route-history-drop",
        tone: "accent",
        text: `Biggest drop: ${state.recentMovement.biggestDrop.topic} (${state.recentMovement.biggestDrop.delta}%). Replay this shape before switching topics.`,
        actionHref: "/history",
        actionLabel: "Replay shape",
      };
    }
    if (state.recentMovement.biggestGain) {
      return {
        id: "route-history-gain",
        tone: "success",
        text: `Biggest gain: ${state.recentMovement.biggestGain.topic} (+${state.recentMovement.biggestGain.delta}%). Lock it with one deliberate retry.`,
        actionHref: state.recommendedAction.primaryHref,
        actionLabel: state.recommendedAction.primaryLabel,
      };
    }
  }

  if (route === "lessons" && state.weakestSkill) {
    return {
      id: "route-lesson-bridge",
      tone: "accent",
      text: `Use this lesson as repair, then immediately retry ${state.weakestSkill.subskill} in focused practice.`,
      actionHref: focusedPracticeHref(state.weakestSkill.subject, state.weakestSkill.subskill),
      actionLabel: "Run focused retry",
    };
  }

  return null;
}

export default function FloatingCoachDock({ compact = false }: FloatingCoachDockProps) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const { state, loading } = useStudentState({ dueLimit: 60, historyLimit: 48 });
  const modeParam = searchParams.get("mode");
  const subskillParam = searchParams.get("subskill");
  const revisitParam = searchParams.get("revisit") === "1";

  const messages = useMemo(() => {
    if (!state) return [];
    const routeMessage = routeAwareMessage({
      pathname,
      state,
      modeParam,
      subskillParam,
      revisitParam,
    });
    const combined = [routeMessage, ...coachMessagesForPath(pathname, state)].filter(
      (message): message is ContextualCoachMessage => !!message
    );
    const seen = new Set<string>();
    return combined.filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }, [modeParam, pathname, revisitParam, state, subskillParam]);

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
            "ink-surface mb-3 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-[#294170] shadow-2xl backdrop-blur",
            compact ? "p-3" : "p-4",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9fc1ff]">{routeLabel(pathname)}</div>
              <div className="mt-1 text-sm font-semibold text-white">{primaryAction?.title ?? "Keep the loop tight"}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-[#4d6798] bg-white/10 px-2 py-1 text-xs font-semibold text-[#d7e3fb] hover:bg-white/20"
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
                className="inline-flex items-center justify-center rounded-lg border border-white/40 bg-white px-3 py-2 text-xs font-semibold text-[#0f1b33]"
              >
                {primaryAction.primaryLabel}
              </Link>
            ) : (
              <Link
                href="/today"
                className="inline-flex items-center justify-center rounded-lg border border-white/40 bg-white px-3 py-2 text-xs font-semibold text-[#0f1b33]"
              >
                Back to Today
              </Link>
            )}
            <Link
              href="/coach"
              className="inline-flex items-center justify-center rounded-lg border border-[#526c9e] bg-white/10 px-3 py-2 text-xs font-semibold text-[#dbe6fb]"
            >
              Open Coach page
            </Link>
          </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#d2def5]">
                <span className="rounded-full border border-[#4b6390] bg-white/10 px-2.5 py-1">
                  Review {state.reviewDebt.dueCount}
                </span>
            {state.weakestSkill && (
              <span className="rounded-full border border-[#4b6390] bg-white/10 px-2.5 py-1">
                Weak {state.weakestSkill.subskill}
              </span>
            )}
            <span className="rounded-full border border-[#4b6390] bg-white/10 px-2.5 py-1">
              Mode {state.recommendedPracticeMode}
            </span>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group inline-flex items-center gap-2 rounded-full border border-[#2c4676] bg-[linear-gradient(135deg,#101d35,#1e355f)] px-4 py-3 text-sm font-semibold text-white shadow-xl"
      >
        <span>Coach</span>
        <span className="rounded-full border border-white/40 bg-white/12 px-2 py-0.5 text-[11px]">
          {state.reviewDebt.dueCount > 0 ? `${state.reviewDebt.dueCount} due` : "ready"}
        </span>
      </button>
    </div>
  );
}
