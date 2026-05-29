'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStudySessionQuestions,
  getStudySessions,
  type StudySessionMode,
  type StudySessionQuestionRecord,
  type StudySessionRecord,
} from "../lib/sessionHistory";
import { errorMessage } from "../lib/errors";
import { focusedLessonHref, focusedPracticeHref, subjectForTopic } from "../lib/mastery";
import { getMyPlanTier } from "../lib/planTier";
import { tierDefinition, type PlanTier } from "../lib/productTiers";
import {
  fmtSessionDate,
  hasComparableSessionShape,
  replaySessionHref,
  sessionModeLabel,
} from "../lib/studentState";
import { useStudentState } from "../lib/useStudentState";
import { HistoryTrajectoryCompanion } from "../components/PageVisualCompanions";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

type ModeFilter = "all" | StudySessionMode;

function sessionLabel(session: StudySessionRecord): string {
  const base = sessionModeLabel(session.mode);
  if (session.mode === "practice" && session.variant) return `${base} • ${session.variant}`;
  return base;
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
  const [questionRows, setQuestionRows] = useState<StudySessionQuestionRecord[]>([]);
  const [questionRowsLoading, setQuestionRowsLoading] = useState(false);
  const [questionRowsError, setQuestionRowsError] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

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
    let cancelled = false;

    const run = async () => {
      if (!selected?.id) {
        setQuestionRows([]);
        setSelectedQuestionId(null);
        setQuestionRowsError(null);
        setQuestionRowsLoading(false);
        return;
      }

      setQuestionRowsLoading(true);
      setQuestionRowsError(null);
      try {
        const rows = await getStudySessionQuestions(selected.id);
        if (cancelled) return;
        setQuestionRows(rows);
        setSelectedQuestionId(rows[0]?.id ?? null);
      } catch (e: unknown) {
        if (cancelled) return;
        setQuestionRows([]);
        setSelectedQuestionId(null);
        setQuestionRowsError(errorMessage(e, "Question-level history is unavailable for this session."));
      } finally {
        if (!cancelled) {
          setQuestionRowsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

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
      if (hasComparableSessionShape(selected, sessions[i])) return sessions[i];
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
        href: focusedPracticeHref(subjectForTopic(weakestTopic.subject), weakestTopic.topic),
      };
    }

    return {
      label: "Replay same shape",
      href: replaySessionHref(selected),
    };
  }, [selected, weakestTopic]);

  const selectedQuestion = useMemo(
    () => questionRows.find((question) => question.id === selectedQuestionId) ?? questionRows[0] ?? null,
    [questionRows, selectedQuestionId]
  );

  const selectedQuestionRetryHref = useMemo(() => {
    if (!selectedQuestion) return null;
    const topic = selectedQuestion.topic?.trim() || null;
    if (!topic) return null;
    const subject = subjectForTopic(selectedQuestion.subject);
    return `${focusedPracticeHref(subject, topic)}&mode=trainer`;
  }, [selectedQuestion]);

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
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            <div className="p-5 sm:p-6">
              <HistoryTrajectoryCompanion
                delta={comparison?.accuracyDelta ?? null}
                gainLabel={comparison?.biggestGain ? `${comparison.biggestGain.topic} +${comparison.biggestGain.delta}%` : null}
                dropLabel={comparison?.biggestDrop ? `${comparison.biggestDrop.topic} ${comparison.biggestDrop.delta}%` : null}
                reviewDue={studentState?.reviewDebt.dueCount ?? 0}
              />

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
                <div>
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
                    {selected.correctCount}/{selected.answeredCount} • {Math.max(1, Math.round(selected.durationSeconds / 60))}m • {fmtSessionDate(selected.createdAt)}
                  </div>
                  {weakestTopic && (
                    <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-[#d9e5fb]">
                      Weakest in this session: <span className="font-semibold text-white">{weakestTopic.topic}</span>
                      {" "}({weakestTopic.accuracyPct}%).
                    </div>
                  )}
                  {comparison && (
                    <div className="mt-3 text-sm text-[#d9e5fb]">
                      Change vs comparable:{" "}
                      <span className="font-semibold text-white">{comparison.accuracyDelta >= 0 ? "+" : ""}{comparison.accuracyDelta}%</span>
                      <span className="mx-2 text-[#8fa6cb]">•</span>
                      Gain {comparison.biggestGain ? `${comparison.biggestGain.topic} (+${comparison.biggestGain.delta}%)` : "none"}
                      <span className="mx-2 text-[#8fa6cb]">•</span>
                      Drop {comparison.biggestDrop ? `${comparison.biggestDrop.topic} (${comparison.biggestDrop.delta}%)` : "none"}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {studentState ? (
                    <>
                      <PrimaryButton href={studentState.recommendedAction.primaryHref}>
                        {studentState.recommendedAction.primaryLabel}
                      </PrimaryButton>
                      <SecondaryButton href={studentState.recommendedAction.secondaryHref}>
                        {studentState.recommendedAction.secondaryLabel}
                      </SecondaryButton>
                    </>
                  ) : replayPrimary ? (
                    <PrimaryButton href={replayPrimary.href}>{replayPrimary.label}</PrimaryButton>
                  ) : (
                    <PrimaryButton href={replaySessionHref(selected)}>Replay same shape</PrimaryButton>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/20 px-5 py-4 sm:px-6">
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
              <SecondaryButton href={replaySessionHref(selected)}>Replay same shape</SecondaryButton>
              <SecondaryButton href="/review">Open review queue</SecondaryButton>
            </div>

            {weakestTopic && (
              <div className="mt-4 rounded-2xl border border-[#b7d2ff] bg-white p-4 text-sm text-gray-700">
                Weakest retry target: <span className="font-semibold text-black">{weakestTopic.topic}</span> ({weakestTopic.accuracyPct}%).
                <div className="mt-2 grid gap-2 sm:max-w-md sm:grid-cols-2">
                  <SecondaryButton href={focusedLessonHref(weakestTopic.topic)}>Open lesson</SecondaryButton>
                  <SecondaryButton href={focusedPracticeHref(subjectForTopic(weakestTopic.subject), weakestTopic.topic)}>
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
                    Topic movement vs {fmtSessionDate(previousComparable.createdAt)}
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

          <section className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Question review
            </div>
            <div className="mt-2 text-sm text-gray-700">
              Inspect exact answers from this session and route immediately.
            </div>

            {questionRowsLoading && (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Loading question attempts...
              </div>
            )}

            {!questionRowsLoading && questionRowsError && (
              <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                {questionRowsError}
              </div>
            )}

            {!questionRowsLoading && !questionRowsError && questionRows.length === 0 && (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                No question snapshots for this session yet. New sessions now save question-level history automatically.
              </div>
            )}

            {!questionRowsLoading && !questionRowsError && questionRows.length > 0 && selectedQuestion && (
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Session questions
                  </div>
                  <div className="grid gap-2">
                    {questionRows.map((row) => {
                      const active = selectedQuestion.id === row.id;
                      return (
                        <button
                          key={row.id}
                          onClick={() => setSelectedQuestionId(row.id)}
                          className={[
                            "rounded-xl border px-3 py-2 text-left text-xs transition",
                            active
                              ? "border-[#0f1b33] bg-[#edf5ff] text-[#0f1b33]"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                          ].join(" ")}
                        >
                          <div className="font-semibold">
                            Q{row.position} • {row.topic || "Unknown topic"}
                          </div>
                          <div className="mt-1">
                            Selected {row.selectedOption || "—"} • Correct {row.correctOption || "—"} •{" "}
                            {row.isCorrect ? "Correct" : "Miss"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-black">
                      Q{selectedQuestion.position} • {selectedQuestion.topic || "Unknown topic"}
                    </div>
                    <Pill text={selectedQuestion.isCorrect ? "Correct" : "Miss"} tone={selectedQuestion.isCorrect ? "success" : "danger"} />
                  </div>

                  <div className="mt-3 text-sm leading-relaxed text-gray-900 whitespace-pre-line">
                    {selectedQuestion.questionText}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {([
                      { key: "A", value: selectedQuestion.optionA },
                      { key: "B", value: selectedQuestion.optionB },
                      { key: "C", value: selectedQuestion.optionC },
                      { key: "D", value: selectedQuestion.optionD },
                    ] as const).map((option) => {
                      const chosen = option.key === selectedQuestion.selectedOption;
                      const correct = option.key === selectedQuestion.correctOption;
                      return (
                        <div
                          key={option.key}
                          className={[
                            "rounded-lg border px-3 py-2 text-sm",
                            correct
                              ? "border-[#9de0bb] bg-[#ebfdf2] text-[#0f8a4e]"
                              : chosen
                              ? "border-[#f5b8c4] bg-[#fff2f5] text-[#b02039]"
                              : "border-gray-200 bg-gray-50 text-gray-700",
                          ].join(" ")}
                        >
                          <span className="mr-2 font-semibold">{option.key}.</span>
                          {option.value}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                    {selectedQuestion.explanation
                      ? selectedQuestion.explanation
                      : "No explanation saved for this question yet."}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {selectedQuestionRetryHref && (
                      <PrimaryButton href={selectedQuestionRetryHref}>Retry this topic</PrimaryButton>
                    )}
                    {!selectedQuestion.isCorrect && (
                      <SecondaryButton href="/review">Review this mistake type</SecondaryButton>
                    )}
                    {selectedQuestion.isCorrect && <SecondaryButton href={replaySessionHref(selected)}>Replay session shape</SecondaryButton>}
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
