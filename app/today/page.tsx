'use client';
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { focusedLessonHref, focusedPracticeHref } from "../lib/mastery";
import { replaySessionHref } from "../lib/studentState";
import { useStudentState } from "../lib/useStudentState";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

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
  if (days === null) return "Set SAT date";
  if (days < 0) return "Update date";
  if (days === 0) return "SAT today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function debtTone(count: number): "success" | "accent" | "danger" {
  if (count === 0) return "success";
  if (count <= 8) return "accent";
  return "danger";
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
    if (!state) return "Loading your mission";
    return `${state.profile.nickname} • ${countdownText(daysLeft)}`;
  }, [daysLeft, state]);

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
          <button
            onClick={logout}
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
          >
            Logout
          </button>
        }
      />

      {loading && (
        <Card title="Loading…" subtitle="Syncing your student state">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && error && (
        <Card title="Error" subtitle="Today could not load">
          <div className="text-sm text-red-600">{error}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={() => void refresh()}>Try again</PrimaryButton>
            <SecondaryButton href="/profile">Profile</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !error && state && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.18fr_0.82fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Today&apos;s command
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {state.recommendedAction.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
                  {state.recommendedAction.reason}
                </p>
                <div className="mt-2 text-xs text-[#b8c8e6]">{state.recommendedAction.payoff}</div>
                <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
                  <PrimaryButton href={state.recommendedAction.primaryHref}>
                    {state.recommendedAction.primaryLabel}
                  </PrimaryButton>
                  <SecondaryButton href={state.recommendedAction.secondaryHref}>
                    {state.recommendedAction.secondaryLabel}
                  </SecondaryButton>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Review debt</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{state.reviewDebt.dueCount}</div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">{state.reviewDebt.pressure} pressure</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Weakest active skill</div>
                  <div className="mt-1 text-base font-semibold text-white">
                    {state.weakestSkill ? state.weakestSkill.subskill : "Not established"}
                  </div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">
                    {state.weakestSkill
                      ? `${state.weakestSkill.subject} • ${state.weakestSkill.accuracyPct}% • ${state.weakestSkill.attempts} attempts`
                      : "Run one block to establish priority."}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Recent movement</div>
                  <div className="mt-1 text-sm text-[#d2dbec]">{state.historyProof.lastMovementText}</div>
                </div>
              </div>
            </div>
          </section>

          <Card title="Student state snapshot" subtitle="Where you are now, what is weak, and what changed." accent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Mastered</div>
                <div className="mt-2 text-2xl font-semibold text-[#0f172a]">{state.masteryDistribution.Mastered}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Growing</div>
                <div className="mt-2 text-2xl font-semibold text-[#0f172a]">{state.masteryDistribution.Growing}</div>
              </div>
              <div className="rounded-2xl border border-[#f5b8c4] bg-[#fff5f7] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f1d35]">Unstable</div>
                <div className="mt-2 text-2xl font-semibold text-[#8f1d35]">{state.masteryDistribution.Unstable}</div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Low-signal rows</div>
                <div className="mt-2 text-2xl font-semibold text-[#0f172a]">{state.lowSignalCount}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Pill text={`Debt ${state.reviewDebt.dueCount}`} tone={debtTone(state.reviewDebt.dueCount)} />
              <Pill text={`Mode ${state.recommendedPracticeMode}`} tone="accent" />
              <Pill text={`Plan ${state.profile.planLabel}`} tone="neutral" />
              {state.engagement && (
                <Pill text={`${state.engagement.divisionLabel} L${state.engagement.level} • ${state.engagement.streakDays}d streak`} tone="neutral" />
              )}
            </div>
          </Card>

          <Card title="Action lanes" subtitle="Choose one lane and execute now.">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-black">Recover debt</div>
                <div className="mt-2 text-xs text-gray-600">
                  {state.reviewDebt.dueCount > 0
                    ? `${state.reviewDebt.dueCount} due now. Clear a block before new content.`
                    : "Debt is clear. Keep it that way."}
                </div>
                <div className="mt-3">
                  <SecondaryButton href="/review">Open review</SecondaryButton>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-black">Attack weak skill</div>
                <div className="mt-2 text-xs text-gray-600">
                  {state.weakestSkill
                    ? `${state.weakestSkill.subskill} • ${state.weakestSkill.accuracyPct}% • ${state.weakestSkill.confidence} confidence`
                    : "No weak skill yet. Generate one more block."}
                </div>
                <div className="mt-3">
                  <SecondaryButton
                    href={
                      state.weakestSkill
                        ? focusedPracticeHref(state.weakestSkill.subject, state.weakestSkill.subskill, true)
                        : "/practice?subject=Reading"
                    }
                  >
                    Drill now
                  </SecondaryButton>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-black">Replay recent session</div>
                <div className="mt-2 text-xs text-gray-600">{state.historyProof.lastSessionLabel}</div>
                <div className="mt-3">
                  {state.recentMovement.latest ? (
                    <SecondaryButton href={replaySessionHref(state.recentMovement.latest)}>Replay shape</SecondaryButton>
                  ) : (
                    <SecondaryButton href="/history">Open history</SecondaryButton>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-black">Repair with lesson</div>
                <div className="mt-2 text-xs text-gray-600">
                  {state.weakestSkill
                    ? `Bridge into ${state.weakestSkill.subskill}, then return to retry.`
                    : "Open lesson library and pick one high-value repair playbook."}
                </div>
                <div className="mt-3">
                  <SecondaryButton
                    href={
                      state.weakestSkill
                        ? focusedLessonHref(state.weakestSkill.subskill)
                        : "/lessons"
                    }
                  >
                    Open lesson
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </Card>

          <section className="rounded-2xl border border-gray-200 bg-white/92 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Coach pulse</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {state.contextualMessages.today.slice(0, 4).map((message) => (
                <div key={message.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                  {message.text}
                  {message.actionHref && message.actionLabel && (
                    <div className="mt-2">
                      <Link href={message.actionHref} className="text-xs font-semibold text-[#004aad] underline">
                        {message.actionLabel}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
