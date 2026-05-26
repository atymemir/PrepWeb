'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import {
  confidenceLabel,
  pct,
  sortWeakest,
  weaknessScore,
  type SkillRow as SharedSkillRow,
} from "../lib/learningSignals";
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

export default function SkillsPage() {
  const router = useRouter();

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
    const selected = focusKey ? decorated.find((row) => row.key === focusKey) ?? null : null;
    if (selected) return selected;
    return (
      sortForExecution(decorated).find((row) => row.mastery === "Unstable") ||
      sortForExecution(decorated).find((row) => row.mastery === "Growing") ||
      sortForExecution(decorated)[0] ||
      null
    );
  }, [decorated, focusKey]);

  const weakest3 = useMemo(() => sortWeakest(rows).slice(0, 3), [rows]);

  const blockedRows = useMemo(() => {
    return decorated.filter((row) => row.movement === "Stuck").slice(0, 3);
  }, [decorated]);

  const missionNext = focusRow ? "Lessons" : "Practice";

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Mastery command"
        title="Skills"
        subtitle="Pick one exact subtopic, execute, and verify movement."
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
        note="Use this page as a precision selector, not as a report."
      />

      {loading && (
        <Card title="Loading…" subtitle="Pulling your mastery map">
          <div className="text-sm text-gray-600">Please wait.</div>
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
        <Card title="No mastery signal yet" subtitle="Run one full set before using diagnostics.">
          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton href={`/practice?subject=${subject}`}>Start practice (12Q)</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="grid gap-5">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Active focus target
                </div>
                {focusRow ? (
                  <>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {focusRow.subskill}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                      {focusRow.domain} • {focusRow.skill} • {masteryDescription(focusRow.mastery)}
                    </p>
                    <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                      <PrimaryButton href={focusedPracticeHref(subject, focusRow.subskill, true)}>
                        Practice this subtopic
                      </PrimaryButton>
                      <SecondaryButton href={focusedLessonHref(focusRow.subskill)}>
                        Open lesson
                      </SecondaryButton>
                    </div>
                  </>
                ) : (
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Choose a subtopic</h2>
                )}
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Unstable now</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{stateCounts.Unstable}</div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">Highest-priority repair queue</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Growing</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{stateCounts.Growing}</div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">Close to stable control</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Mastered</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{stateCounts.Mastered}</div>
                  <div className="mt-1 text-xs text-[#c5d1e8]">Maintain with light retests</div>
                </div>
              </div>
            </div>
          </section>

          <Card title="Mastery state map" subtitle="Filter by state, then select one subtopic to execute." accent>
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
                <div className="flex flex-wrap gap-2">
                  {(["All", ...MASTERY_ORDER] as const).map((state) => {
                    const active = stateFilter === state;
                    const count =
                      state === "All" ? decorated.length : stateCounts[state as MasteryState];

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
                      No subskills match the current filter.
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

                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${
                              row.mastery === "Mastered"
                                ? "bg-[#2a9b67]"
                                : row.mastery === "Growing"
                                ? "bg-[#4a7fd8]"
                                : row.mastery === "Unstable"
                                ? "bg-[#d54768]"
                                : "bg-gray-400"
                            }`}
                            style={{ width: `${Math.max(6, Math.min(100, pct(row.accuracy)))}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Card
                  title="Focused execution"
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
                        <PrimaryButton href={focusedPracticeHref(subject, focusRow.subskill, true)}>
                          Run focused practice
                        </PrimaryButton>
                        <SecondaryButton href={focusedLessonHref(focusRow.subskill)}>
                          Open repair lesson
                        </SecondaryButton>
                        <SecondaryButton href="/review">Open recovery queue</SecondaryButton>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">No subtopic selected.</div>
                  )}
                </Card>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Most blocked subtopics" subtitle="Where performance is not moving despite volume.">
              <div className="grid gap-2">
                {blockedRows.length === 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    No subtopic is currently flagged as blocked.
                  </div>
                )}
                {blockedRows.map((row) => (
                  <button
                    key={`blocked-${row.key}`}
                    onClick={() => setFocusKey(row.key)}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-black">{row.subskill}</div>
                      <Pill text="Stuck" tone="danger" />
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {pct(row.accuracy)}% over {row.attempts} attempts
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Immediate repair queue" subtitle="Top execution targets right now.">
              <div className="grid gap-2">
                {weakest3.map((row, i) => (
                  <button
                    key={`weak-${rowKey(row)}-${i}`}
                    onClick={() => setFocusKey(rowKey(row))}
                    className="rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-black">{row.subskill}</div>
                      <div className="text-xs font-semibold text-gray-500">#{i + 1}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      {pct(row.accuracy)}% • {row.attempts} attempts • {confidenceLabel(row.attempts)} confidence
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
