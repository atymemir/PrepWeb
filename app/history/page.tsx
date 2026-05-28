'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStudySessions,
  type StudySessionMode,
  type StudySessionRecord,
} from "../lib/sessionHistory";
import { errorMessage } from "../lib/errors";
import { focusedLessonHref, focusedPracticeHref, subjectForTopic } from "../lib/mastery";
import { getMyPlanTier } from "../lib/planTier";
import { tierDefinition, type PlanTier } from "../lib/productTiers";
import { useStudentState } from "../lib/useStudentState";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

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
  const { state: studentState } = useStudentState({ dueLimit: 80, historyLimit: 80 });

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
    let cancelled = false;
    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!filteredSessions.length) {
        setSelectedId(null);
        return;
      }
      if (!selectedId || !filteredSessions.some((session) => session.id === selectedId)) {
        setSelectedId(filteredSessions[0].id);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
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

  const comparison = useMemo(() => {
    if (!selected || !previousComparable) return null;

    const accuracyDelta = selected.accuracyPct - previousComparable.accuracyPct;
    const correctDelta = selected.correctCount - previousComparable.correctCount;
    const durationDeltaMinutes = Math.round((selected.durationSeconds - previousComparable.durationSeconds) / 60);

    const previousTopicMap = new Map(previousComparable.topics.map((topic) => [topic.topic, topic.accuracyPct]));
    const topicDeltas = selected.topics
      .filter((topic) => previousTopicMap.has(topic.topic))
      .map((topic) => ({
        topic: topic.topic,
        current: topic.accuracyPct,
        previous: previousTopicMap.get(topic.topic) ?? topic.accuracyPct,
      }))
      .map((topic) => ({
        ...topic,
        delta: topic.current - topic.previous,
      }))
      .sort((a, b) => a.delta - b.delta);

    const biggestDrop = topicDeltas.find((topic) => topic.delta < 0) ?? null;
    const biggestGain = [...topicDeltas].reverse().find((topic) => topic.delta > 0) ?? null;

    return {
      accuracyDelta,
      correctDelta,
      durationDeltaMinutes,
      biggestDrop,
      biggestGain,
    };
  }, [selected, previousComparable]);

  const replayPrimary = useMemo(() => {
    if (!selected) return null;

    if (selected.mode === "review") {
      return {
        label: "Continue recovery queue",
        href: "/review",
      };
    }

    if (weakestTopic) {
      return {
        label: `Retry ${weakestTopic.topic}`,
        href: focusedPracticeHref(subjectForTopic(weakestTopic.subject), weakestTopic.topic, true),
      };
    }

    return {
      label: "Replay same shape",
      href: replayHref(selected),
    };
  }, [selected, weakestTopic]);

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
        label="History"
        title="History"
        subtitle="Replay, retry, compare."
        right={
          <button
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
            onClick={() => router.push("/today")}
          >
            Back
          </button>
        }
      />

      {loading && (
        <Card title="Loading…" subtitle="Pulling your session history">
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
        <Card title="No history yet" subtitle="Finish one session to unlock replay and compare.">
          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton href="/practice?subject=Reading">Start practice</PrimaryButton>
            <SecondaryButton href="/review">Open review</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && sessions.length > 0 && selected && (
        <div className="grid gap-4">
          {studentState && (
            <section className="rounded-2xl border border-gray-200 bg-white/92 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                  Unified command
                </div>
                <Pill text={`Debt ${studentState.reviewDebt.dueCount}`} tone={studentState.reviewDebt.dueCount > 0 ? "danger" : "success"} />
              </div>
              <div className="mt-2 text-sm font-semibold text-black">{studentState.recommendedAction.title}</div>
              <div className="mt-1 text-xs text-gray-600">{studentState.historyProof.lastMovementText}</div>
              <div className="mt-3 grid gap-2 sm:max-w-xl sm:grid-cols-2">
                <SecondaryButton href={studentState.recommendedAction.primaryHref}>
                  {studentState.recommendedAction.primaryLabel}
                </SecondaryButton>
                <SecondaryButton href={studentState.recommendedAction.secondaryHref}>
                  {studentState.recommendedAction.secondaryLabel}
                </SecondaryButton>
              </div>
            </section>
          )}

          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            <div className="p-5 sm:p-6">
              <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                Selected session
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {sessionLabel(selected)}
                </h2>
                <Pill text={`${selected.accuracyPct}%`} tone={selected.accuracyPct >= 75 ? "success" : "accent"} />
              </div>
              <div className="mt-2 text-sm text-[#d2dbec]">
                {selected.correctCount}/{selected.answeredCount} • {Math.max(1, Math.round(selected.durationSeconds / 60))}m • {fmtDate(selected.createdAt)}
              </div>
              {weakestTopic && (
                <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-[#d9e5fb]">
                  Weakest in this session: <span className="font-semibold text-white">{weakestTopic.topic}</span>
                  {" "}({weakestTopic.accuracyPct}%).
                </div>
              )}
              <div className="mt-5 border-t border-white/20 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold text-white">Choose session</div>
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
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            active
                              ? "border-white bg-white text-[#0e1b34]"
                              : "border-white/40 bg-white/10 text-[#d8e5ff] hover:border-white/70",
                          ].join(" ")}
                        >
                          {item.label} ({item.count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sessions.length >= tier.limits.historySessionLimit && (
                  <div className="mt-3 rounded-xl border border-white/20 bg-white/10 p-3 text-xs text-[#d8e5ff]">
                    History cap reached: {tier.limits.historySessionLimit} sessions on {tier.label}.
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {filteredSessions.slice(0, 12).map((session) => {
                    const active = selected.id === session.id;
                    return (
                      <button
                        key={session.id}
                        onClick={() => setSelectedId(session.id)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition",
                          active
                            ? "border-white/70 bg-white text-[#0f1b33]"
                            : "border-white/30 bg-white/10 text-[#d8e5ff] hover:border-white/45 hover:bg-white/15",
                        ].join(" ")}
                      >
                        {sessionLabel(session)} • {session.accuracyPct}% • {Math.max(1, Math.round(session.durationSeconds / 60))}m
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#c7dbff] bg-[#f6faff] p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Replay / retry
            </div>
            <div className="mt-2 text-sm text-gray-700">
              Use this session signal immediately while recall is still fresh.
            </div>
            <div className="mt-4 grid gap-3 sm:max-w-3xl sm:grid-cols-3">
              {replayPrimary && <PrimaryButton href={replayPrimary.href}>{replayPrimary.label}</PrimaryButton>}
              <SecondaryButton href={replayHref(selected)}>Replay same shape</SecondaryButton>
              <SecondaryButton href="/review">Open review queue</SecondaryButton>
            </div>

            {weakestTopic && (
              <div className="mt-4 rounded-2xl border border-[#b7d2ff] bg-white p-4 text-sm text-gray-700">
                Weakest retry target: <span className="font-semibold text-black">{weakestTopic.topic}</span> ({weakestTopic.accuracyPct}%).
                <div className="mt-2 grid gap-2 sm:max-w-md sm:grid-cols-2">
                  <SecondaryButton href={focusedLessonHref(weakestTopic.topic)}>Open lesson</SecondaryButton>
                  <SecondaryButton href={focusedPracticeHref(subjectForTopic(weakestTopic.subject), weakestTopic.topic, true)}>
                    Retry topic
                  </SecondaryButton>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Compare / what changed
            </div>

            {!comparison || !previousComparable ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                No prior similar session yet. Replay this same shape once to unlock comparison signal.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Accuracy <span className="font-semibold text-black">{comparison.accuracyDelta >= 0 ? "+" : ""}{comparison.accuracyDelta}%</span>
                  <span className="mx-2 text-gray-300">•</span>
                  Correct <span className="font-semibold text-black">{comparison.correctDelta >= 0 ? "+" : ""}{comparison.correctDelta}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  Time <span className="font-semibold text-black">{comparison.durationDeltaMinutes >= 0 ? "+" : ""}{comparison.durationDeltaMinutes}m</span>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Topic movement vs {fmtDate(previousComparable.createdAt)}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
                      Biggest drop:{" "}
                      <span className="font-semibold text-black">
                        {comparison.biggestDrop
                          ? `${comparison.biggestDrop.topic} (${comparison.biggestDrop.delta >= 0 ? "+" : ""}${comparison.biggestDrop.delta}%)`
                          : "No drop detected"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700">
                      Biggest gain:{" "}
                      <span className="font-semibold text-black">
                        {comparison.biggestGain
                          ? `${comparison.biggestGain.topic} (+${comparison.biggestGain.delta}%)`
                          : "No gain detected"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
