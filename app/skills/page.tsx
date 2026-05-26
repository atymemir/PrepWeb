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
import { ActionDock, Card, LoopRail, PageHeader, PagePurpose, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

type Row = SharedSkillRow;

type DomainSummary = {
  domain: string;
  count: number;
  avgAccuracy: number;
  weakest: Row | null;
};

function groupByDomain(rows: Row[]) {
  const map = new Map<string, Row[]>();

  for (const row of rows) {
    const key = row.domain || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }

  return [...map.entries()]
    .map(([domain, rows]) => ({
      domain,
      rows: [...rows].sort((a, b) => {
        const aScore = weaknessScore(a);
        const bScore = weaknessScore(b);
        if (aScore !== bScore) return aScore - bScore;
        return a.subskill.localeCompare(b.subskill);
      }),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

function buildDomainSummaries(rows: Row[]): DomainSummary[] {
  const grouped = groupByDomain(rows);

  return grouped
    .map(({ domain, rows }) => {
      const count = rows.length;
      const avgAccuracy =
        count > 0
          ? rows.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) / count
          : 0;

      return {
        domain,
        count,
        avgAccuracy,
        weakest: sortWeakest(rows)[0] ?? null,
      };
    })
    .sort((a, b) => {
      if (a.avgAccuracy !== b.avgAccuracy) return a.avgAccuracy - b.avgAccuracy;
      return a.domain.localeCompare(b.domain);
    });
}

export default function SkillsPage() {
  const router = useRouter();

  const [subject, setSubject] = useState<"Math" | "Reading">("Reading");
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
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
    } catch (e: any) {
      setErr(e?.message || "Failed to load skills.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const subskill = r.subskill?.toLowerCase() ?? "";
      const skill = r.skill?.toLowerCase() ?? "";
      const domain = r.domain?.toLowerCase() ?? "";
      return subskill.includes(q) || skill.includes(q) || domain.includes(q);
    });
  }, [rows, query]);

  const weakest3 = useMemo(() => sortWeakest(rows).slice(0, 3), [rows]);
  const topWeak = weakest3[0] ?? null;
  const domainSummaries = useMemo(() => buildDomainSummaries(rows), [rows]);
  const groupedFiltered = useMemo(() => groupByDomain(filtered), [filtered]);

  const stableSignalCount = useMemo(() => rows.filter((r) => r.attempts >= 6).length, [rows]);
  const lowSignalCount = useMemo(() => rows.filter((r) => r.attempts < 6).length, [rows]);

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Diagnostic workspace"
        title="Skills"
        subtitle="Find the weakest signal, repair it, then re-test it."
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

      <LoopRail active="Skills" next={topWeak ? "Lessons" : "Practice"} note="Use this page to choose one repair target, not five." />
      <PagePurpose
        purpose="Skills ranks what is weak."
        instruction={
          topWeak
            ? `Fix one target first: ${topWeak.subskill}.`
            : "Generate a little more practice signal so weak-zone ranking becomes reliable."
        }
        why="Diagnostics only matter when they immediately drive your next block."
      />

      {loading && (
        <Card title="Loading…" subtitle="Pulling your mastery data">
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
        <Card title="No skill signal yet" subtitle="You need at least one practice set first.">
          <div className="text-sm text-gray-700">
            This page becomes useful only after ALGA sees enough question-level performance to rank weak areas.
          </div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton href={`/practice?subject=${subject}`}>Start practice (12Q)</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="grid gap-4">
          <Card
            title="This week’s repair plan"
            subtitle="Best current fixes based on weakness and sample size."
            right={<Pill text={subject} tone="accent" />}
            accent
          >
            <div className="grid gap-3">
              {weakest3.map((r, i) => (
                <div
                  key={`${r.subskill}-${i}`}
                  className="rounded-2xl border border-[#d9e7ff] bg-gradient-to-r from-[#f8fbff] to-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#c7dbff] bg-[#eef4ff] text-sm font-semibold text-[#004aad]">
                          {i + 1}
                        </div>
                        <div className="text-base font-semibold text-black">{r.subskill}</div>
                      </div>

                      <div className="mt-2 text-xs text-gray-600">
                        {r.domain} • {r.skill}
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                            Accuracy
                          </div>
                          <div className="mt-1 text-lg font-semibold text-black">{pct(r.accuracy)}%</div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                            Attempts
                          </div>
                          <div className="mt-1 text-lg font-semibold text-black">{r.attempts}</div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                            Confidence
                          </div>
                          <div className="mt-1 text-lg font-semibold text-[#004aad]">
                            {confidenceLabel(r.attempts)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton href={`/practice?subject=${subject}&subskill=${encodeURIComponent(r.subskill)}`}>
                      Practice this
                    </PrimaryButton>
                    <SecondaryButton href={`/lesson/${encodeURIComponent(r.subskill)}`}>
                      Open lesson
                    </SecondaryButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Low-confidence weakness does not mean “ignore it.” It means “collect more evidence before making a hard judgment.”
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Card title="Signal quality" subtitle="Not every weak signal is equally trustworthy.">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatBox
                  label="Tracked subskills"
                  value={String(rows.length)}
                  hint="Currently visible rows"
                />
                <StatBox
                  label="Stable signal"
                  value={String(stableSignalCount)}
                  hint="At least 6 attempts"
                  accent
                />
                <StatBox
                  label="Low signal"
                  value={String(lowSignalCount)}
                  hint="Needs more attempts"
                />
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Use stable signal to prioritize. Use low signal as a warning, not a final verdict.
              </div>
            </Card>

            <Card
              title="Domain summary"
              subtitle="Weakness is easier to understand when grouped by domain."
              right={<Pill text={`${domainSummaries.length} domains`} />}
            >
              <div className="grid gap-3">
                {domainSummaries.map((d) => (
                  <div key={d.domain} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-black">{d.domain}</div>
                        <div className="mt-1 text-sm text-gray-700">
                          Average accuracy {pct(d.avgAccuracy)}% across {d.count} subskills
                        </div>
                        {d.weakest && (
                          <div className="mt-2 text-xs text-gray-600">
                            Weakest here: {d.weakest.subskill} ({pct(d.weakest.accuracy)}%, n={d.weakest.attempts})
                          </div>
                        )}
                      </div>

                      {d.weakest ? (
                        <a
                          href={`/practice?subject=${subject}&subskill=${encodeURIComponent(d.weakest.subskill)}`}
                          className="inline-flex items-center rounded-full border border-[#c7dbff] bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#004aad] transition hover:bg-[#dfeeff]"
                        >
                          Fix weakest
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card
            title="Mastery map"
            subtitle="Search, inspect, and choose what to repair next."
            right={<Pill text={`${filtered.length} visible`} />}
          >
            <div className="flex flex-col gap-4">
              <input
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#004aad]"
                placeholder="Search subskill / skill / domain…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {!loading && !err && filtered.length === 0 && (
                <div className="text-sm text-gray-600">
                  No matches for “{query.trim()}”.
                </div>
              )}

              {!loading && !err && filtered.length > 0 && (
                <div className="grid gap-4">
                  {groupedFiltered.map(({ domain, rows }) => (
                    <div key={domain} className="overflow-hidden rounded-2xl border border-gray-200">
                      <div className="border-b border-gray-200 bg-gradient-to-r from-[#f8fbff] to-white px-4 py-3">
                        <div className="text-sm font-semibold text-black">{domain}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          {rows.length} visible subskills
                        </div>
                      </div>

                      <ul className="divide-y divide-gray-200 bg-white">
                        {rows.map((r, i) => (
                          <li
                            key={`${domain}-${r.subskill}-${i}`}
                            className="flex items-start justify-between gap-4 px-4 py-4"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-black">{r.subskill}</div>
                              <div className="mt-1 text-xs text-gray-600">
                                {r.skill} • {pct(r.accuracy)}% (n={r.attempts}) • {confidenceLabel(r.attempts)}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <a
                                className="text-sm font-semibold text-[#004aad] underline hover:text-[#003b88]"
                                href={`/practice?subject=${subject}&subskill=${encodeURIComponent(r.subskill)}`}
                              >
                                Practice
                              </a>
                              <a
                                className="text-xs text-gray-500 underline hover:text-black"
                                href={`/lesson/${encodeURIComponent(r.subskill)}`}
                              >
                                Lesson
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500">
                This is a diagnostic layer, not a vanity layer. Use it to choose what to repair next.
              </div>
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && (
        <ActionDock
          title="Diagnostic next action"
          note={
            topWeak
              ? `${topWeak.subskill}: ${pct(topWeak.accuracy)}% over ${topWeak.attempts} attempts.`
              : "No stable weak row yet."
          }
          primary={{
            label: topWeak ? "Practice top weak zone" : `Start ${subject} practice`,
            href: topWeak
              ? `/practice?subject=${subject}&subskill=${encodeURIComponent(topWeak.subskill)}`
              : `/practice?subject=${subject}`,
          }}
          secondary={
            topWeak
              ? {
                  label: "Open matching lesson",
                  href: `/lesson/${encodeURIComponent(topWeak.subskill)}`,
                }
              : { label: "Back to Today", href: "/today" }
          }
        />
      )}
    </main>
  );
}
