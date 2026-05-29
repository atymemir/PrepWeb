'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { focusedLessonHref, focusedPracticeHref } from "../lib/mastery";
import { replaySessionHref, sessionModeLabel } from "../lib/studentState";
import { TodayPressureCompanion } from "../components/PageVisualCompanions";
import { getSupabase } from "../lib/supabase";
import { useStudentState } from "../lib/useStudentState";
import { Card, PageHeader, PrimaryButton, SecondaryButton } from "../ui/ui";

type ActionLaneId =
  | "clear_debt"
  | "attack_weak_skill"
  | "replay_recent_weak_session"
  | "open_repair_lesson";

type ActionLane = {
  id: ActionLaneId;
  title: string;
  whyNow: string;
  payoff: string;
  href: string;
  cta: string;
  priority: number;
  order: number;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function countdownText(days: number | null): string {
  if (days === null) return "Set your exam date";
  if (days < 0) return "Exam date passed";
  if (days === 0) return "Exam day";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

function pressureLabel(pressure: "clear" | "light" | "moderate" | "heavy"): string {
  if (pressure === "heavy") return "Heavy";
  if (pressure === "moderate") return "Moderate";
  if (pressure === "light") return "Light";
  return "Clear";
}

function conciseReason(text: string): string {
  const clean = text.trim();
  if (!clean) return "Execute this now while this bottleneck is still active.";
  const firstSentence = clean.split(". ")[0]?.trim() ?? clean;
  if (!firstSentence) return clean;
  return /[.!?]$/.test(firstSentence) ? firstSentence : `${firstSentence}.`;
}

function signedPct(value: number | null): string {
  if (value === null) return "No delta";
  if (value > 0) return `+${value}%`;
  return `${value}%`;
}

function sessionSubjectLabel(subject: string | null): string {
  if (subject === "Math" || subject === "Reading" || subject === "Combined") return subject;
  return "Mixed";
}

function streakLabel(days: number): string {
  return `${days} day${days === 1 ? "" : "s"} streak`;
}

export default function TodayPage() {
  const router = useRouter();
  const { state, loading, error, refresh } = useStudentState({ dueLimit: 80, historyLimit: 64 });

  useEffect(() => {
    if (!error) return;
    if (error.toLowerCase().includes("sign in")) {
      router.push("/login");
    }
  }, [error, router]);

  const daysLeft = useMemo(() => daysUntil(state?.profile.examDate ?? null), [state?.profile.examDate]);
  const subtitle = useMemo(() => {
    if (!state) return "Building your plan for today";
    return `${state.profile.nickname} • ${countdownText(daysLeft)}`;
  }, [daysLeft, state]);
  const nowStatus = useMemo(() => {
    if (!state?.engagement) return "No active ranked signal yet";
    return `${state.engagement.divisionLabel} L${state.engagement.level} • ${streakLabel(state.engagement.streakDays)}`;
  }, [state]);

  const actionLanes = useMemo<ActionLane[]>(() => {
    if (!state) return [];

    const weakest = state.weakestSkill;
    const latest = state.recentMovement.latest;
    const topDebtTopic = state.reviewDebt.topTopics[0];
    const recentDrop = state.recentMovement.biggestDrop;

    const clearDebtLane: ActionLane = {
      id: "clear_debt",
      title: "Clear debt",
      whyNow:
        state.reviewDebt.dueCount > 0
          ? `${state.reviewDebt.dueCount} review items are due (${pressureLabel(state.reviewDebt.pressure)} pressure).`
          : "Review queue is clear.",
      payoff:
        state.reviewDebt.dueCount > 0
          ? "Removes old misses so your next set gives cleaner data."
          : "Keeps recall stable and catches slips early.",
      href: "/review",
      cta: state.reviewDebt.dueCount > 0 ? `Clear ${state.reviewDebt.blockSize} now` : "Open review",
      priority: state.reviewDebt.dueCount > 0 ? 100 : 36,
      order: 1,
    };

    const attackWeakSkillLane: ActionLane = {
      id: "attack_weak_skill",
      title: "Attack weak skill",
      whyNow: weakest
        ? `${weakest.subject} ${weakest.subskill} is at ${weakest.accuracyPct}% over ${weakest.attempts} attempts.`
        : "No locked weak skill yet; run one focused set to create a target.",
      payoff: weakest
        ? "Raises your biggest score drag right now."
        : "Creates the next clear weakness to work on.",
      href: weakest
        ? focusedPracticeHref(weakest.subject, weakest.subskill)
        : "/practice?subject=Reading",
      cta: weakest ? `Practice ${weakest.subskill}` : "Start focused set",
      priority: weakest ? (state.reviewDebt.dueCount === 0 ? 92 : 74) : 26,
      order: 2,
    };

    const replayRecentLane: ActionLane = {
      id: "replay_recent_weak_session",
      title: "Replay recent weak session",
      whyNow: latest
        ? recentDrop
          ? `${sessionModeLabel(latest.mode)} ${latest.accuracyPct}% in ${sessionSubjectLabel(latest.subject)}. Biggest drop: ${recentDrop.topic} (${recentDrop.delta}%).`
          : `${sessionModeLabel(latest.mode)} ${latest.accuracyPct}% in ${sessionSubjectLabel(latest.subject)}.`
        : "No recent session to replay yet.",
      payoff: latest
        ? "Gives before/after proof before changing route."
        : "Creates your first baseline to compare against.",
      href: latest ? replaySessionHref(latest) : "/history",
      cta: latest ? "Replay session" : "Open history",
      priority: latest
        ? state.recentMovement.accuracyDelta !== null && state.recentMovement.accuracyDelta < 0
          ? 84
          : 56
        : 18,
      order: 3,
    };

    const openLessonLane: ActionLane = {
      id: "open_repair_lesson",
      title: "Open repair lesson",
      whyNow: weakest
        ? `Patch ${weakest.subskill} before the next retry block.`
        : topDebtTopic
        ? `Repair ${topDebtTopic.subject} ${topDebtTopic.topic} before it piles up again.`
        : "Open one lesson to sharpen technique before volume.",
      payoff: "Turns weakness into a direct fix plan.",
      href: weakest ? focusedLessonHref(weakest.subskill) : "/lessons",
      cta: weakest ? `Open ${weakest.subskill} lesson` : "Open lessons",
      priority: weakest ? 48 : 22,
      order: 4,
    };

    return [clearDebtLane, attackWeakSkillLane, replayRecentLane, openLessonLane].sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.order - b.order;
    });
  }, [state]);

  const primaryLane = actionLanes[0] ?? null;
  const secondaryLanes = actionLanes.slice(1);

  async function logout() {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // No-op.
    }
    router.push("/login");
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Today"
        title="Today"
        subtitle={subtitle}
        right={
          <button onClick={logout} className="text-sm font-semibold text-gray-600 hover:text-black underline">
            Logout
          </button>
        }
      />

      {loading && (
        <Card title="Loading your plan" subtitle="Syncing your latest practice and review data">
          <div className="space-y-2">
            <div className="state-skeleton h-3 w-2/3" />
            <div className="state-skeleton h-3 w-1/2" />
            <div className="state-skeleton h-28 w-full" />
          </div>
        </Card>
      )}

      {!loading && error && (
        <Card title="Today is unavailable" subtitle="We could not load your plan right now.">
          <div className="text-sm text-red-600">{error}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={() => void refresh()}>Try again</PrimaryButton>
            <SecondaryButton href="/profile">Open profile</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !error && state && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Mission
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {state.recommendedAction.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
                  Why now: {conciseReason(state.recommendedAction.reason)}
                </p>
                <div className="mt-2 text-xs text-[#b8c8e6]">If you do this now: {state.recommendedAction.payoff}</div>

                <div className="mt-5 max-w-sm">
                  <PrimaryButton href={state.recommendedAction.primaryHref}>{state.recommendedAction.primaryLabel}</PrimaryButton>
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Where you are now</div>
                <div className="mt-2 text-xl font-semibold text-white">{countdownText(daysLeft)}</div>
                <div className="mt-1 text-sm text-[#d2dbec]">{nowStatus}</div>
                <div className="mt-4 border-t border-white/15 pt-3 text-xs text-[#c5d1e8]">
                  Plan: {state.profile.planLabel} · Review pressure {pressureLabel(state.reviewDebt.pressure)}
                </div>
                <div className="mt-3 text-xs text-[#c7d7f3]">
                  Active target: {state.weakestSkill ? `${state.weakestSkill.subject} ${state.weakestSkill.subskill}` : "Generate first weak target"}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-5 sm:px-6">
              <TodayPressureCompanion
                pressure={state.reviewDebt.pressure}
                dueCount={state.reviewDebt.dueCount}
                weakAccuracy={state.weakestSkill?.accuracyPct ?? null}
                movementDelta={state.recentMovement.accuracyDelta}
              />
            </div>
          </section>

          <Card title="Evidence" subtitle="What is weak or problematic right now." accent prominence="prominent">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#cfe2ff] bg-[#f7fbff] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Weakest active skill</div>
                {state.weakestSkill ? (
                  <>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0e1b34]">
                      {state.weakestSkill.subskill} · {state.weakestSkill.accuracyPct}%
                    </div>
                    <div className="mt-1 text-sm text-[#4d607f]">
                      {state.weakestSkill.subject} · {state.weakestSkill.attempts} attempts · {state.weakestSkill.mastery} mastery ·{" "}
                      {state.weakestSkill.movement} movement
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-[#4d607f]">
                    No active weak skill yet. One focused set will create your first target.
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#516483]">Review debt pressure</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0f172a]">{state.reviewDebt.dueCount}</div>
                  <div className="mt-1 text-sm text-[#4d607f]">
                    {pressureLabel(state.reviewDebt.pressure)} pressure
                    {state.reviewDebt.topTopics[0]
                      ? ` · Top pileup: ${state.reviewDebt.topTopics[0].subject} ${state.reviewDebt.topTopics[0].topic} (${state.reviewDebt.topTopics[0].count})`
                      : ""}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#516483]">Recent movement</div>
                  {state.recentMovement.latest ? (
                    <>
                      <div className="mt-2 text-base font-semibold text-[#0f172a]">
                        {signedPct(state.recentMovement.accuracyDelta)} vs comparable block
                      </div>
                      <div className="mt-1 text-sm text-[#4d607f]">
                        {sessionModeLabel(state.recentMovement.latest.mode)} · {sessionSubjectLabel(state.recentMovement.latest.subject)} ·{" "}
                        {state.recentMovement.latest.accuracyPct}% ({state.recentMovement.latest.correctCount}/
                        {state.recentMovement.latest.answeredCount})
                        {state.recentMovement.biggestDrop
                          ? ` · Drop: ${state.recentMovement.biggestDrop.topic} (${state.recentMovement.biggestDrop.delta}%)`
                          : ""}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-[#4d607f]">No recent movement yet. Complete one session to create proof.</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Action lanes" subtitle="What to do now, in order.">
            <div className="space-y-3">
              {primaryLane && (
                <div className="rounded-2xl border border-[#a9c9fa] bg-[linear-gradient(145deg,#edf5ff,#f8fbff)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Primary lane</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight text-[#0e1b34]">{primaryLane.title}</div>
                  <div className="mt-1 text-sm text-[#4d607f]">{primaryLane.whyNow}</div>
                  <div className="mt-1 text-xs text-[#617394]">{primaryLane.payoff}</div>
                  <div className="mt-4 max-w-sm">
                    <PrimaryButton href={primaryLane.href}>{primaryLane.cta}</PrimaryButton>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
                {secondaryLanes.map((lane) => (
                  <div key={lane.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_220px] sm:items-center">
                    <div>
                      <div className="text-sm font-semibold text-[#0f172a]">{lane.title}</div>
                      <div className="mt-1 text-sm text-[#4d607f]">{lane.whyNow}</div>
                      <div className="mt-1 text-xs text-[#617394]">{lane.payoff}</div>
                    </div>
                    <SecondaryButton href={lane.href}>{lane.cta}</SecondaryButton>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
