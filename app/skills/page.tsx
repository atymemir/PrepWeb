'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { confidenceLabel, pct, weaknessScore, type SkillRow as SharedSkillRow } from "../lib/learningSignals";
import {
  focusedLessonHref,
  focusedPracticeHref,
  masteryDescription,
  masteryFor,
  masteryTone,
  movementDescription,
  movementFor,
  movementTone,
  type MasteryState,
  type MovementState,
} from "../lib/mastery";
import { useStudentState } from "../lib/useStudentState";
import { SkillsMapCompanion } from "../components/PageVisualCompanions";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

type Row = SharedSkillRow;
type StateFilter = "All" | MasteryState;

type DecoratedRow = Row & {
  key: string;
  mastery: MasteryState;
  movement: MovementState;
};

const MASTERY_ORDER: MasteryState[] = ["Unstable", "Growing", "Mastered", "Untouched"];

function rowKey(row: Row): string {
  return `${row.domain || "Other"}::${row.subskill}`;
}

function sortForExecution(rows: DecoratedRow[]): DecoratedRow[] {
  const stateRank = new Map<MasteryState, number>([
    ["Unstable", 0],
    ["Growing", 1],
    ["Untouched", 2],
    ["Mastered", 3],
  ]);

  return [...rows].sort((a, b) => {
    const aState = stateRank.get(a.mastery) ?? 99;
    const bState = stateRank.get(b.mastery) ?? 99;
    if (aState !== bState) return aState - bState;

    const aScore = weaknessScore(a);
    const bScore = weaknessScore(b);
    if (aScore !== bScore) return aScore - bScore;

    if ((a.attempts ?? 0) !== (b.attempts ?? 0)) return b.attempts - a.attempts;
    return a.subskill.localeCompare(b.subskill);
  });
}

function sortForStrength(rows: DecoratedRow[]): DecoratedRow[] {
  return [...rows].sort((a, b) => {
    const aMastered = a.mastery === "Mastered" ? 1 : 0;
    const bMastered = b.mastery === "Mastered" ? 1 : 0;
    if (aMastered !== bMastered) return bMastered - aMastered;
    if (pct(a.accuracy) !== pct(b.accuracy)) return pct(b.accuracy) - pct(a.accuracy);
    if ((a.attempts ?? 0) !== (b.attempts ?? 0)) return b.attempts - a.attempts;
    return a.subskill.localeCompare(b.subskill);
  });
}

function payoffForMastery(state: MasteryState): string {
  if (state === "Unstable") return "Stabilize this skill to stop active score leakage in the next block.";
  if (state === "Growing") return "Push this to mastered and lock predictable points.";
  if (state === "Mastered") return "Maintain this signal while attacking weaker skills.";
  return "Generate fresh evidence and remove blind spots.";
}

function signedDelta(delta: number | null): string | null {
  if (delta === null || !Number.isFinite(delta)) return null;
  if (delta > 0) return `+${delta}%`;
  return `${delta}%`;
}

export default function SkillsPage() {
  const router = useRouter();
  const { state: studentState } = useStudentState({ dueLimit: 80, historyLimit: 64 });

  const [subject, setSubject] = useState<"Math" | "Reading">("Reading");
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("Unstable");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const { data: res, error } = await supabase.rpc("get_skill_mastery", {
        p_subject: subject,
      });

      if (error) throw new Error(error.message);
      setRows((res ?? []) as Row[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load skills.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    setFocusKey(null);
    setStateFilter("Unstable");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const decorated = useMemo<DecoratedRow[]>(() => {
    return rows.map((row) => ({
      ...row,
      key: rowKey(row),
      mastery: masteryFor({ attempts: row.attempts, accuracy: row.accuracy }),
      movement: movementFor({ attempts: row.attempts, accuracy: row.accuracy }),
    }));
  }, [rows]);

  const executionRows = useMemo(() => sortForExecution(decorated), [decorated]);

  const stateCounts = useMemo(() => {
    return {
      Mastered: decorated.filter((row) => row.mastery === "Mastered").length,
      Growing: decorated.filter((row) => row.mastery === "Growing").length,
      Unstable: decorated.filter((row) => row.mastery === "Unstable").length,
      Untouched: decorated.filter((row) => row.mastery === "Untouched").length,
    };
  }, [decorated]);

  useEffect(() => {
    if (stateFilter !== "Unstable") return;
    if (stateCounts.Unstable > 0) return;
    if (stateCounts.Growing > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStateFilter("Growing");
      return;
    }
    setStateFilter("All");
  }, [stateCounts, stateFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortForExecution(
      decorated.filter((row) => {
        if (stateFilter !== "All" && row.mastery !== stateFilter) return false;
        if (!q) return true;
        const target = `${row.subskill} ${row.skill} ${row.domain}`.toLowerCase();
        return target.includes(q);
      })
    );
  }, [decorated, query, stateFilter]);

  const focusRow = useMemo(() => {
    const selected = focusKey ? executionRows.find((row) => row.key === focusKey) ?? null : null;
    if (selected) return selected;
    return executionRows.find((row) => row.mastery === "Unstable")
      ?? executionRows.find((row) => row.mastery === "Growing")
      ?? executionRows[0]
      ?? null;
  }, [executionRows, focusKey]);

  const strongestRows = useMemo(() => {
    return sortForStrength(
      decorated.filter((row) => row.mastery !== "Untouched" && row.attempts >= 6)
    ).slice(0, 3);
  }, [decorated]);

  const riskRows = useMemo(() => {
    return sortForExecution(
      decorated.filter((row) => row.mastery === "Unstable" || row.movement === "Stuck" || row.movement === "Volatile")
    ).slice(0, 4);
  }, [decorated]);

  const missionReason = useMemo(() => {
    if (!focusRow) return "Choose one subskill and execute immediately.";
    return `${pct(focusRow.accuracy)}% over ${focusRow.attempts} attempts • ${focusRow.movement} signal`;
  }, [focusRow]);

  const movementSummary = useMemo(() => {
    if (!studentState?.recentMovement.latest) {
      return {
        tone: "neutral" as const,
        headline: "No movement proof yet",
        detail: "Finish one comparable block to unlock stable before/after deltas.",
      };
    }

    const delta = studentState.recentMovement.accuracyDelta;
    const deltaText = signedDelta(delta);
    if (!deltaText) {
      return {
        tone: "neutral" as const,
        headline: studentState.historyProof.lastSessionLabel,
        detail: "No comparable prior block yet. Replay similar shape to unlock deltas.",
      };
    }

    const gain = studentState.recentMovement.biggestGain
      ? `${studentState.recentMovement.biggestGain.topic} +${studentState.recentMovement.biggestGain.delta}%`
      : "No topic gain yet";
    const drop = studentState.recentMovement.biggestDrop
      ? `${studentState.recentMovement.biggestDrop.topic} ${studentState.recentMovement.biggestDrop.delta}%`
      : "No topic drop";

    return {
      tone: (delta ?? 0) >= 0 ? ("success" as const) : ("danger" as const),
      headline: `Comparable block change: ${deltaText}`,
      detail: `${gain} • ${drop}`,
    };
  }, [studentState]);

  const strongestLabel = strongestRows[0]
    ? `${strongestRows[0].subskill} ${pct(strongestRows[0].accuracy)}%`
    : "No stabilized strengths yet";

  const missionNext = "Practice";

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Skills"
        title="Skills"
        subtitle="One clear attack, clear evidence, and a fast route back to focused retry."
        right={
          <div className="flex gap-2">
            <button
              onClick={() => setSubject("Reading")}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                subject === "Reading"
                  ? "border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Reading
            </button>
            <button
              onClick={() => setSubject("Math")}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                subject === "Math"
                  ? "border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Math
            </button>
          </div>
        }
      />

      <LoopRail
        active="Skills"
        next={missionNext}
        note="Attack one skill, run focused retry, then verify movement proof."
      />

      {loading && (
        <Card title="Loading skills" subtitle="Pulling your skill map">
          <div className="space-y-2">
            <div className="state-skeleton h-3 w-2/3" />
            <div className="state-skeleton h-3 w-1/2" />
            <div className="state-skeleton h-24 w-full" />
          </div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Skills could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={load}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && rows.length === 0 && (
        <Card title="No skill data yet" subtitle="Complete a short diagnostic to unlock your skill map.">
          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton href={`/practice?subject=${subject}`}>Start practice (12Q)</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="grid gap-5">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="p-5 sm:p-6">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Recommended skill attack
                </div>
                {focusRow ? (
                  <>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {focusRow.subskill}
                    </h2>
                    <p className="mt-2 text-sm text-[#d2dbec]">
                      {focusRow.domain} • {focusRow.skill}
                    </p>
                    <p className="mt-2 text-sm text-[#d2dbec]">{missionReason}</p>
                    <p className="mt-2 text-xs text-[#c2d0ea]">{payoffForMastery(focusRow.mastery)}</p>
                    <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                      <PrimaryButton href={focusedPracticeHref(subject, focusRow.subskill)}>
                        Start focused retry
                      </PrimaryButton>
                      <SecondaryButton href={focusedLessonHref(focusRow.subskill)}>
                        Open repair lesson
                      </SecondaryButton>
                    </div>
                  </>
                ) : (
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Choose a subtopic</h2>
                )}
              </div>

              <div className="mt-5">
                <SkillsMapCompanion
                  unstable={stateCounts.Unstable}
                  growing={stateCounts.Growing}
                  mastered={stateCounts.Mastered}
                  untouched={stateCounts.Untouched}
                  movementDelta={studentState?.recentMovement.accuracyDelta ?? null}
                />
              </div>
            </div>
          </section>

          <Card title="Performance evidence" subtitle="See clearly where you are strong and where you are leaking points." accent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#9cdab6] bg-[#eefbf4] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f8a4e]">Working now</div>
                <div className="mt-2 grid gap-2">
                  {strongestRows.length === 0 && (
                    <div className="rounded-xl border border-[#d4ecd9] bg-white p-3 text-sm text-[#2e6f4a]">
                      No stabilized subskills yet. Build one anchor with focused reps.
                    </div>
                  )}
                  {strongestRows.map((row) => (
                    <button
                      key={`strong-${row.key}`}
                      onClick={() => setFocusKey(row.key)}
                      className="rounded-xl border border-[#c8e9d5] bg-white p-3 text-left transition hover:border-[#98d8b7]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[#0f172a]">{row.subskill}</div>
                        <Pill text={row.mastery} tone={masteryTone(row.mastery)} />
                      </div>
                      <div className="mt-1 text-xs text-[#40644c]">
                        {pct(row.accuracy)}% • {row.attempts} attempts
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#f4c0cb] bg-[#fff3f6] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#b02039]">At risk now</div>
                <div className="mt-2 grid gap-2">
                  {riskRows.length === 0 && (
                    <div className="rounded-xl border border-[#f2d7de] bg-white p-3 text-sm text-[#84515c]">
                      No urgent weak rows in this subject right now.
                    </div>
                  )}
                  {riskRows.map((row) => (
                    <button
                      key={`risk-${row.key}`}
                      onClick={() => setFocusKey(row.key)}
                      className="rounded-xl border border-[#f0d2da] bg-white p-3 text-left transition hover:border-[#e5a9b9]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[#0f172a]">{row.subskill}</div>
                        <Pill text={row.mastery} tone={masteryTone(row.mastery)} />
                      </div>
                      <div className="mt-1 text-xs text-[#805864]">
                        {pct(row.accuracy)}% • {row.attempts} attempts • {row.movement}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#546883]">Recent movement proof</div>
                <Pill text={movementSummary.tone === "danger" ? "Slipping" : movementSummary.tone === "success" ? "Improving" : "Pending proof"} tone={movementSummary.tone} />
              </div>
              <div className="mt-2 text-sm font-semibold text-[#0f172a]">{movementSummary.headline}</div>
              <div className="mt-1 text-xs text-[#5e718f]">{movementSummary.detail}</div>
              <div className="mt-3 max-w-xs">
                <SecondaryButton href="/history">Open full movement history</SecondaryButton>
              </div>
            </div>
          </Card>

          <Card title="Skill map and attack lane" subtitle="Pick one row, then execute immediately." accent>
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
                <div className="flex flex-wrap gap-2">
                  {(["All", ...MASTERY_ORDER] as const).map((state) => {
                    const active = stateFilter === state;
                    const count = state === "All" ? decorated.length : stateCounts[state];

                    return (
                      <button
                        key={state}
                        onClick={() => setStateFilter(state)}
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          active
                            ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                        ].join(" ")}
                      >
                        {state} ({count})
                      </button>
                    );
                  })}
                </div>

                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none"
                  placeholder="Search subskill / skill / domain"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="grid gap-2">
                  {filtered.length === 0 && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                      No subskills match this filter.
                    </div>
                  )}

                  {filtered.map((row) => {
                    const active = focusRow?.key === row.key;
                    return (
                      <button
                        key={row.key}
                        onClick={() => setFocusKey(row.key)}
                        className={[
                          "rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-[#0f1b33] bg-[#edf5ff]"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-black">{row.subskill}</div>
                            <div className="mt-1 text-xs text-gray-600">
                              {row.domain} • {row.skill}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Pill text={row.mastery} tone={masteryTone(row.mastery)} />
                            <Pill text={row.movement} tone={movementTone(row.movement)} />
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="text-xs text-gray-600">
                            Accuracy <span className="font-semibold text-black">{pct(row.accuracy)}%</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Attempts <span className="font-semibold text-black">{row.attempts}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Confidence <span className="font-semibold text-black">{confidenceLabel(row.attempts)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Card
                  title="Selected attack lane"
                  subtitle={focusRow ? movementDescription(focusRow.movement) : "Pick one row from the left."}
                  right={focusRow ? <Pill text={focusRow.mastery} tone={masteryTone(focusRow.mastery)} /> : null}
                  prominence="prominent"
                  accent
                >
                  {focusRow ? (
                    <div className="grid gap-4">
                      <div>
                        <div className="text-xl font-semibold text-black">{focusRow.subskill}</div>
                        <div className="mt-1 text-sm text-gray-600">
                          {focusRow.domain} • {focusRow.skill}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <StatBox label="Accuracy" value={`${pct(focusRow.accuracy)}%`} hint="Current signal" accent={focusRow.mastery !== "Unstable"} />
                        <StatBox label="Attempts" value={`${focusRow.attempts}`} hint={confidenceLabel(focusRow.attempts)} />
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                        {masteryDescription(focusRow.mastery)}
                      </div>

                      <div className="grid gap-3">
                        <PrimaryButton href={focusedPracticeHref(subject, focusRow.subskill)}>
                          Run focused retry now
                        </PrimaryButton>
                        <SecondaryButton href={focusedLessonHref(focusRow.subskill)}>
                          Open repair lesson
                        </SecondaryButton>
                        {studentState?.reviewDebt.dueCount ? (
                          <SecondaryButton href="/review">
                            Clear review debt ({studentState.reviewDebt.blockSize}Q)
                          </SecondaryButton>
                        ) : (
                          <SecondaryButton href="/history">Verify movement in history</SecondaryButton>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">No subtopic selected.</div>
                  )}
                </Card>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
