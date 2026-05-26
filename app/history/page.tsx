'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildSessionAnalytics,
  getStudySessions,
  type StudySessionMode,
  type StudySessionRecord,
} from "../lib/sessionHistory";
import { errorMessage } from "../lib/errors";
import { focusedLessonHref, focusedPracticeHref, subjectForTopic } from "../lib/mastery";
import { getMyPlanTier } from "../lib/planTier";
import { tierDefinition, type PlanTier } from "../lib/productTiers";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

type ModeFilter = "all" | StudySessionMode;

function sessionLabel(session: StudySessionRecord): string {
  if (session.mode === "exam") return "Exam";
  if (session.mode === "review") return "Review";
  return session.variant ? `Practice • ${session.variant}` : "Practice";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function subjectForPractice(raw: string | null): "Reading" | "Math" | "Combined" {
  if (raw === "Math") return "Math";
  if (raw === "Combined") return "Combined";
  return "Reading";
}

function replayHref(session: StudySessionRecord): string {
  if (session.mode === "review") return "/review";

  const params = new URLSearchParams();
  params.set("subject", subjectForPractice(session.subject));

  if (session.mode === "exam") {
    params.set("mode", "exam");
    return `/practice?${params.toString()}`;
  }

  if (session.variant === "timed" || session.variant === "exam" || session.variant === "trainer") {
    params.set("mode", session.variant);
  }

  if (session.subskill) {
    params.set("subskill", session.subskill);
    params.set("revisit", "1");
  }

  return `/practice?${params.toString()}`;
}

function sessionNarrative(session: StudySessionRecord): string {
  if (session.mode === "exam") {
    return "Exam replay. Use this to verify pacing, unanswered risk, and weak-topic carryover.";
  }
  if (session.mode === "review") {
    return "Recovery replay. Check what debt was actually cleared and what remained unstable.";
  }
  if (session.variant === "timed") {
    return "Timed practice replay. Compare execution stability under pressure.";
  }
  return "Practice replay. Re-run the same shape to verify whether the weak signal improved.";
}

function hasComparableShape(a: StudySessionRecord, b: StudySessionRecord): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "review") return true;
  const aSubject = a.subject ?? "Mixed";
  const bSubject = b.subject ?? "Mixed";
  if (aSubject !== bSubject) return false;
  if ((a.variant ?? "") !== (b.variant ?? "")) return false;
  if ((a.subskill ?? "") !== (b.subskill ?? "")) return false;
  return true;
}

export default function HistoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [planTier, setPlanTier] = useState<PlanTier>("free");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      let resolvedTier: PlanTier = "free";
      try {
        resolvedTier = await getMyPlanTier();
      } catch {
        resolvedTier = "free";
      }
      setPlanTier(resolvedTier);
      const rows = await getStudySessions(tierDefinition(resolvedTier).limits.historySessionLimit);
      setSessions(rows);
      const fromQuery =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("session")
          : null;
      const defaultId = fromQuery && rows.some((s) => s.id === fromQuery) ? fromQuery : rows[0]?.id ?? null;
      setSelectedId(defaultId);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load session history."));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSessions = useMemo(() => {
    if (modeFilter === "all") return sessions;
    return sessions.filter((session) => session.mode === modeFilter);
  }, [sessions, modeFilter]);

  useEffect(() => {
    if (!filteredSessions.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredSessions.some((session) => session.id === selectedId)) {
      setSelectedId(filteredSessions[0].id);
    }
  }, [filteredSessions, selectedId]);

  const selected = useMemo(
    () => filteredSessions.find((session) => session.id === selectedId) ?? filteredSessions[0] ?? null,
    [filteredSessions, selectedId]
  );

  useEffect(() => {
    if (!selected?.id || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("session", selected.id);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", next);
  }, [selected?.id]);

  const analytics = useMemo(() => buildSessionAnalytics(sessions), [sessions]);
  const tier = useMemo(() => tierDefinition(planTier), [planTier]);

  const weakestTopic = useMemo(() => {
    if (!selected?.topics.length) return null;
    return selected.topics.slice().sort((a, b) => a.accuracyPct - b.accuracyPct)[0] ?? null;
  }, [selected]);

  const previousComparable = useMemo(() => {
    if (!selected) return null;
    const idx = sessions.findIndex((session) => session.id === selected.id);
    if (idx < 0) return null;
    for (let i = idx + 1; i < sessions.length; i += 1) {
      if (hasComparableShape(selected, sessions[i])) return sessions[i];
    }
    return null;
  }, [selected, sessions]);

  const selectedDelta = useMemo(() => {
    if (!selected || !previousComparable) return null;

    const topicPrev = new Map(previousComparable.topics.map((topic) => [topic.topic, topic.accuracyPct]));
    const topicMovement = selected.topics
      .map((topic) => ({
        topic: topic.topic,
        previous: topicPrev.get(topic.topic),
        current: topic.accuracyPct,
      }))
      .filter((row) => row.previous !== undefined)
      .map((row) => ({
        ...row,
        delta: row.current - (row.previous as number),
      }))
      .sort((a, b) => a.delta - b.delta);

    return {
      accuracyDelta: selected.accuracyPct - previousComparable.accuracyPct,
      durationDelta: selected.durationSeconds - previousComparable.durationSeconds,
      topicMovement,
    };
  }, [selected, previousComparable]);

  const movementHighlights = useMemo(() => {
    if (!selectedDelta || selectedDelta.topicMovement.length === 0) return null;
    const gains = selectedDelta.topicMovement
      .filter((row) => row.delta > 0)
      .sort((a, b) => b.delta - a.delta);
    const drops = selectedDelta.topicMovement
      .filter((row) => row.delta < 0)
      .sort((a, b) => a.delta - b.delta);
    return {
      bestGain: gains[0] ?? null,
      worstDrop: drops[0] ?? null,
    };
  }, [selectedDelta]);

  const weakTopicRoutes = useMemo(() => {
    if (!selected?.topics?.length) return [];
    return selected.topics
      .slice()
      .sort((a, b) => a.accuracyPct - b.accuracyPct)
      .slice(0, 3)
      .map((topic) => {
        const subject = subjectForTopic(topic.subject);
        return {
          ...topic,
          subject,
          practiceHref: focusedPracticeHref(subject, topic.topic, true),
          lessonHref: focusedLessonHref(topic.topic),
        };
      });
  }, [selected]);

  const modeCounts = useMemo(() => {
    return {
      all: sessions.length,
      practice: sessions.filter((s) => s.mode === "practice").length,
      review: sessions.filter((s) => s.mode === "review").length,
      exam: sessions.filter((s) => s.mode === "exam").length,
    };
  }, [sessions]);

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Replay center"
        title="History"
        subtitle="Replay sessions, compare changes, and launch targeted retries from evidence."
        right={
          <div className="flex items-center gap-2">
            <Pill text={`${tier.label} tier`} tone={tier.key === "free" ? "neutral" : "accent"} />
            <button
              className="text-sm font-semibold text-gray-600 hover:text-black underline"
              onClick={() => router.push("/today")}
            >
              Back
            </button>
          </div>
        }
      />

      {!loading && !err && (
        <LoopRail
          active="Coach"
          note="History should drive the next action, not store dead data."
        />
      )}

      {loading && (
        <Card title="Loading…" subtitle="Pulling your replay archive">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="History could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={load}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && sessions.length === 0 && (
        <Card title="No history yet" subtitle="Finish your first session to unlock replay and retry routing.">
          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton href="/practice?subject=Reading">Start practice</PrimaryButton>
            <SecondaryButton href="/review">Open review</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && sessions.length > 0 && selected && (
        <div className="grid gap-5">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Selected replay
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {sessionLabel(selected)} • {selected.accuracyPct}%
                </h2>
                <p className="mt-2 text-sm text-[#d2dbec]">
                  {selected.correctCount}/{selected.answeredCount} in {Math.max(1, Math.round(selected.durationSeconds / 60))}m • {fmtDate(selected.createdAt)}
                </p>
                <p className="mt-2 text-xs text-[#abc2ea]">{sessionNarrative(selected)}</p>
                <div className="mt-5 grid gap-3 sm:max-w-2xl sm:grid-cols-3">
                  <PrimaryButton href={replayHref(selected)}>Replay same configuration</PrimaryButton>
                  {weakestTopic ? (
                    <SecondaryButton
                      href={focusedPracticeHref(subjectForTopic(weakestTopic.subject), weakestTopic.topic, true)}
                    >
                      Retry weakest topic
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton href="/practice?subject=Reading">Run new practice block</SecondaryButton>
                  )}
                  {selected.mode === "review" ? (
                    <SecondaryButton href="/review">Continue recovery queue</SecondaryButton>
                  ) : (
                    <SecondaryButton href="/history">Keep replaying</SecondaryButton>
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Recovery trend</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{analytics.reviewRecoveryTrend.latestAvg ?? "—"}%</div>
                  <div className="mt-1 text-xs text-[#c8d4ed]">
                    Δ {analytics.reviewRecoveryTrend.delta !== null ? `${analytics.reviewRecoveryTrend.delta > 0 ? "+" : ""}${analytics.reviewRecoveryTrend.delta}%` : "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Practice stability</div>
                  <div className="mt-1 text-sm text-[#d2dbec]">
                    Avg {analytics.stability.practiceAvg ?? "—"}% • Range {analytics.stability.practiceRange ?? "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Archive size</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{sessions.length}</div>
                  <div className="mt-1 text-xs text-[#c8d4ed]">
                    Tracked sessions • cap {tier.limits.historySessionLimit}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card title="Replay archive" subtitle="Filter by mode, then open one session for revise routing." accent>
            <div className="grid gap-4">
              {sessions.length >= tier.limits.historySessionLimit && (
                <div className="rounded-xl border border-[#c7dbff] bg-[#f6faff] p-3 text-xs text-gray-700">
                  History window is at your {tier.label} tier cap ({tier.limits.historySessionLimit} sessions).
                  {tier.key === "free" ? " Upgrade to Pro for deeper replay history." : ""}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "all", label: "All", count: modeCounts.all },
                  { key: "practice", label: "Practice", count: modeCounts.practice },
                  { key: "review", label: "Review", count: modeCounts.review },
                  { key: "exam", label: "Exam", count: modeCounts.exam },
                ] as const).map((item) => {
                  const active = modeFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setModeFilter(item.key)}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        active
                          ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                      ].join(" ")}
                    >
                      {item.label} ({item.count})
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <Card title="Session list" subtitle="Newest first" prominence="quiet">
                  <div className="grid gap-2">
                    {filteredSessions.map((session) => {
                      const active = selected.id === session.id;
                      return (
                        <button
                          key={session.id}
                          onClick={() => setSelectedId(session.id)}
                          className={[
                            "rounded-xl border p-3 text-left transition",
                            active
                              ? "border-[#0f1b33] bg-[#edf5ff]"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-black">{sessionLabel(session)}</div>
                            <Pill text={`${session.accuracyPct}%`} tone={session.accuracyPct >= 75 ? "success" : "accent"} />
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {session.correctCount}/{session.answeredCount} • {fmtDate(session.createdAt)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card
                  title={`${sessionLabel(selected)} replay`}
                  subtitle={selected.outcome ? `Outcome: ${selected.outcome}` : "Logged session"}
                  right={<Pill text={selected.mode.toUpperCase()} tone="accent" />}
                  prominence="prominent"
                  accent
                >
                  <div className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatBox label="Accuracy" value={`${selected.accuracyPct}%`} hint="Selected session" accent={selected.accuracyPct >= 75} />
                      <StatBox label="Answered" value={`${selected.answeredCount}`} hint={`of ${selected.totalQuestions}`} />
                      <StatBox label="Duration" value={`${Math.max(1, Math.round(selected.durationSeconds / 60))}m`} hint="Session length" />
                    </div>

                    {tier.limits.advancedHistoryInsights && selectedDelta && previousComparable && (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          Change vs previous comparable session
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="text-sm text-gray-700">
                            Accuracy delta:
                            <span className={`ml-1 font-semibold ${selectedDelta.accuracyDelta >= 0 ? "text-[#0f8a4e]" : "text-[#b02039]"}`}>
                              {selectedDelta.accuracyDelta >= 0 ? "+" : ""}{selectedDelta.accuracyDelta}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-700">
                            Duration delta:
                            <span className={`ml-1 font-semibold ${selectedDelta.durationDelta <= 0 ? "text-[#0f8a4e]" : "text-[#b02039]"}`}>
                              {selectedDelta.durationDelta > 0 ? "+" : ""}{Math.round(selectedDelta.durationDelta / 60)}m
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selected.topics.length > 0 && (
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Weakest topics in this session</div>
                        <div className="mt-3 grid gap-2">
                          {selected.topics
                            .slice()
                            .sort((a, b) => a.accuracyPct - b.accuracyPct)
                            .slice(0, 5)
                            .map((topic) => (
                              <div key={`${selected.id}-${topic.topic}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                <span className="font-semibold text-black">{topic.topic}</span>
                                <span className="mx-1 text-gray-300">•</span>
                                {topic.accuracyPct}% ({topic.correctCount}/{topic.totalCount})
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {tier.limits.advancedHistoryInsights && selectedDelta && selectedDelta.topicMovement.length > 0 && (
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Topic movement vs previous</div>
                        <div className="mt-3 grid gap-2">
                          {selectedDelta.topicMovement.slice(0, 4).map((row) => (
                            <div key={`${selected.id}-${row.topic}`} className="text-sm text-gray-700">
                              <span className="font-semibold text-black">{row.topic}</span>
                              <span className="mx-1 text-gray-300">•</span>
                              {row.previous}% → {row.current}%
                              <span className={`ml-1 font-semibold ${row.delta >= 0 ? "text-[#0f8a4e]" : "text-[#b02039]"}`}>
                                ({row.delta >= 0 ? "+" : ""}{row.delta})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tier.limits.advancedHistoryInsights && movementHighlights && (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          Movement highlights
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                            <span className="font-semibold text-black">Largest gain:</span>{" "}
                            {movementHighlights.bestGain
                              ? `${movementHighlights.bestGain.topic} (+${movementHighlights.bestGain.delta})`
                              : "—"}
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                            <span className="font-semibold text-black">Largest drop:</span>{" "}
                            {movementHighlights.worstDrop
                              ? `${movementHighlights.worstDrop.topic} (${movementHighlights.worstDrop.delta})`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    )}

                    {!tier.limits.advancedHistoryInsights && (
                      <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-4 text-sm text-gray-700">
                        Advanced movement comparison unlocks on Pro and Ultimate tiers.
                      </div>
                    )}

                    {weakTopicRoutes.length > 0 && (
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          Revise from this result
                        </div>
                        <div className="mt-3 grid gap-3">
                          {weakTopicRoutes.map((topic) => (
                            <div key={`${selected.id}-route-${topic.topic}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                              <div className="text-sm font-semibold text-black">{topic.topic}</div>
                              <div className="mt-1 text-xs text-gray-600">
                                {topic.subject} • {topic.accuracyPct}% ({topic.correctCount}/{topic.totalCount})
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <SecondaryButton href={topic.practiceHref}>Practice this topic</SecondaryButton>
                                <SecondaryButton href={topic.lessonHref}>Open lesson</SecondaryButton>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <PrimaryButton href={replayHref(selected)}>Replay this configuration</PrimaryButton>
                      {selected.mode === "review" ? (
                        <SecondaryButton href="/review">Continue recovery queue</SecondaryButton>
                      ) : weakestTopic ? (
                        <SecondaryButton
                          href={focusedPracticeHref(subjectForTopic(weakestTopic.subject), weakestTopic.topic, true)}
                        >
                          Retry weakest topic
                        </SecondaryButton>
                      ) : (
                        <SecondaryButton href="/practice?subject=Reading">Run new practice</SecondaryButton>
                      )}
                      <SecondaryButton href="/today">Back to mission</SecondaryButton>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
