'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildSessionAnalytics,
  getStudySessions,
  type StudySessionRecord,
} from "../lib/sessionHistory";
import { errorMessage } from "../lib/errors";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

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

export default function HistoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const rows = await getStudySessions(120);
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

  const selected = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null,
    [sessions, selectedId]
  );

  const analytics = useMemo(() => buildSessionAnalytics(sessions), [sessions]);

  return (
    <main className="min-h-screen">
      <PageHeader
        label="History"
        title="Session history"
        subtitle="Reopen previous sessions, inspect failures, and route the next block from real results."
        right={
          <button
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
            onClick={() => router.push("/today")}
          >
            Back
          </button>
        }
      />

      {!loading && !err && (
        <LoopRail
          active="Coach"
          note="History closes the loop: run session -> inspect outcome -> launch targeted next session."
        />
      )}

      {loading && (
        <Card title="Loading…" subtitle="Pulling your session archive">
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
        <Card title="No session history yet" subtitle="Complete your first session to start the archive.">
          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton href="/practice?subject=Reading">Start practice</PrimaryButton>
            <SecondaryButton href="/review">Open review</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && sessions.length > 0 && selected && (
        <div className="grid gap-5">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Review recovery trend</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  {analytics.reviewRecoveryTrend.latestAvg ?? "—"}%
                </div>
                <div className="mt-1 text-xs text-[#c8d4ed]">
                  Prev {analytics.reviewRecoveryTrend.previousAvg ?? "—"}%
                  <span className="mx-1 text-[#7389b4]">•</span>
                  {analytics.reviewRecoveryTrend.delta !== null
                    ? `${analytics.reviewRecoveryTrend.delta > 0 ? "+" : ""}${analytics.reviewRecoveryTrend.delta}%`
                    : "No delta yet"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Practice / review stability</div>
                <div className="mt-2 text-sm text-[#d2dbec]">
                  Practice avg {analytics.stability.practiceAvg ?? "—"}% (range {analytics.stability.practiceRange ?? "—"})
                </div>
                <div className="mt-1 text-sm text-[#d2dbec]">
                  Review avg {analytics.stability.reviewAvg ?? "—"}% (range {analytics.stability.reviewRange ?? "—"})
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Weak topic movement</div>
                <div className="mt-2 grid gap-1 text-sm text-[#d2dbec]">
                  {analytics.weakTopicTrend.length > 0 ? (
                    analytics.weakTopicTrend.slice(0, 2).map((row) => (
                      <div key={row.topic}>
                        {row.topic}: {row.firstAcc}% → {row.lastAcc}% ({row.delta > 0 ? "+" : ""}{row.delta})
                      </div>
                    ))
                  ) : (
                    <div>Need repeated topic samples.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <Card title="Decision analytics" subtitle="Use trends to choose what to do next, not just what happened." accent>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Review recovery trend</div>
                <div className="mt-2 text-lg font-semibold text-black">
                  {analytics.reviewRecoveryTrend.latestAvg ?? "—"}%
                  <span className="mx-2 text-gray-300">/</span>
                  prev {analytics.reviewRecoveryTrend.previousAvg ?? "—"}%
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Delta: {analytics.reviewRecoveryTrend.delta !== null ? `${analytics.reviewRecoveryTrend.delta > 0 ? "+" : ""}${analytics.reviewRecoveryTrend.delta}%` : "—"}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Practice vs review stability</div>
                <div className="mt-2 text-sm text-gray-700">
                  Practice avg {analytics.stability.practiceAvg ?? "—"}% (range {analytics.stability.practiceRange ?? "—"})
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  Review avg {analytics.stability.reviewAvg ?? "—"}% (range {analytics.stability.reviewRange ?? "—"})
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Weak topic trend</div>
                <div className="mt-2 grid gap-1 text-sm text-gray-700">
                  {analytics.weakTopicTrend.length > 0 ? (
                    analytics.weakTopicTrend.slice(0, 3).map((row) => (
                      <div key={row.topic}>
                        {row.topic}: {row.firstAcc}% → {row.lastAcc}% ({row.delta > 0 ? "+" : ""}{row.delta})
                      </div>
                    ))
                  ) : (
                    <div>Need more repeated topic samples.</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <Card title="Session timeline" subtitle="Reopen any past session result.">
              <div className="grid gap-2">
                {sessions.map((session) => {
                  const active = selected.id === session.id;
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedId(session.id)}
                      className={[
                        "rounded-2xl border p-3 text-left transition",
                        active
                          ? "border-[#0f1b33] bg-[#edf5ff]"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
              title={`${sessionLabel(selected)} result`}
              subtitle={`${selected.correctCount}/${selected.answeredCount} • ${selected.accuracyPct}%`}
              right={<Pill text={selected.outcome ?? "Logged"} tone="accent" />}
              accent
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Subject: <span className="font-semibold text-black">{selected.subject ?? "Mixed"}</span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Duration: <span className="font-semibold text-black">{Math.round(selected.durationSeconds / 60)}m</span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Questions: <span className="font-semibold text-black">{selected.answeredCount}/{selected.totalQuestions}</span>
                </div>
              </div>

              {selected.topics.length > 0 && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Topic movement in this session</div>
                  <div className="mt-2 grid gap-2">
                    {selected.topics
                      .slice()
                      .sort((a, b) => a.accuracyPct - b.accuracyPct)
                      .slice(0, 6)
                      .map((topic) => (
                        <div key={`${selected.id}-${topic.topic}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          <span className="font-semibold text-black">{topic.topic}</span> • {topic.accuracyPct}% ({topic.correctCount}/{topic.totalCount})
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {selected.topics[0] ? (
                  <PrimaryButton
                    href={`/practice?subject=${selected.topics[0].subject === "Math" ? "Math" : "Reading"}&subskill=${encodeURIComponent(
                      selected.topics
                        .slice()
                        .sort((a, b) => a.accuracyPct - b.accuracyPct)[0].topic
                    )}`}
                  >
                    Re-run weakest topic
                  </PrimaryButton>
                ) : (
                  <PrimaryButton href="/practice?subject=Reading">Run new practice block</PrimaryButton>
                )}
                <SecondaryButton href={selected.mode === "review" ? "/review" : "/today"}>
                  {selected.mode === "review" ? "Open review queue" : "Back to Today"}
                </SecondaryButton>
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
