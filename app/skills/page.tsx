'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";

type Row = {
  domain: string;
  skill: string;
  subskill: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

function confidenceLabel(n: number): "Low" | "Medium" | "High" {
  if (n < 6) return "Low";
  if (n < 15) return "Medium";
  return "High";
}

function pct(x: number | null | undefined): number {
  return Math.round(((x ?? 0) * 100));
}

function sortWeakest(rows: Row[]) {
  // Lowest accuracy first; penalize tiny samples slightly
  return [...rows].sort((a, b) => {
    const aScore = (a.accuracy ?? 0) + (a.attempts < 6 ? 0.15 : 0);
    const bScore = (b.accuracy ?? 0) + (b.attempts < 6 ? 0.15 : 0);
    if (aScore !== bScore) return aScore - bScore;
    return b.attempts - a.attempts;
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

      const { data: res, error } = await supabase.rpc("get_skill_mastery", { p_subject: subject });
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

    return rows.filter(r => {
      const a = r.subskill?.toLowerCase() ?? "";
      const b = r.skill?.toLowerCase() ?? "";
      const c = r.domain?.toLowerCase() ?? "";
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [rows, query]);

  const weakest3 = useMemo(() => {
    return sortWeakest(rows).slice(0, 3);
  }, [rows]);

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Skills"
        subtitle="Mastery map by subskill. Pick the weakest and fix it."
        right={
          <div className="flex gap-2">
            <button
              onClick={() => setSubject("Reading")}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                subject === "Reading" ? "bg-black text-white border-black" : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              Reading
            </button>
            <button
              onClick={() => setSubject("Math")}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                subject === "Math" ? "bg-black text-white border-black" : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              Math
            </button>
          </div>
        }
      />

      {/* Top weak */}
      <Card
        title="Top weak subskills"
        subtitle="Best next actions based on your lowest accuracy (confidence adjusted)."
        right={<Pill text={subject} />}
      >
        {loading && <div className="text-sm text-gray-600">Loading…</div>}

        {!loading && err && (
          <div>
            <div className="text-sm text-red-600">{err}</div>
            <div className="mt-4 grid gap-3">
              <PrimaryButton onClick={load}>Try again</PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && rows.length === 0 && (
          <div>
            <div className="text-sm text-gray-700">
              No skill data yet. Do one 12-question practice set first — then this map becomes useful.
            </div>
            <div className="mt-4 grid gap-3">
              <PrimaryButton href={`/practice?subject=${subject}`}>Start Practice (12Q)</PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && rows.length > 0 && (
          <div className="grid gap-3">
            {weakest3.map((r, i) => (
              <div key={`${r.subskill}-${i}`} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-black">{r.subskill}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      {r.domain} • {r.skill} • {pct(r.accuracy)}% (n={r.attempts}) • confidence {confidenceLabel(r.attempts)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      className="text-sm font-semibold underline text-gray-700 hover:text-black"
                      href={`/lesson/${encodeURIComponent(r.subskill)}`}
                    >
                      Lesson
                    </a>
                    <a
                      className="text-sm font-semibold underline text-gray-700 hover:text-black"
                      href={`/practice?subject=${subject}&subskill=${encodeURIComponent(r.subskill)}`}
                    >
                      Practice
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Search + list */}
      <div className="mt-4">
        <Card
          title="All subskills"
          subtitle="Search and practice specific weaknesses."
          right={<Pill text={`${rows.length} total`} />}
        >
          <div className="flex flex-col gap-3">
            <input
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
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
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                {filtered.slice(0, 120).map((r, i) => (
                  <li key={`${r.subskill}-${i}`} className="flex items-start justify-between gap-4 px-4 py-3 bg-white">
                    <div>
                      <div className="font-medium text-black">{r.subskill}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {r.domain} • {r.skill} • {pct(r.accuracy)}% (n={r.attempts}) • {confidenceLabel(r.attempts)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <a
                        className="text-sm font-semibold underline text-gray-700 hover:text-black"
                        href={`/practice?subject=${subject}&subskill=${encodeURIComponent(r.subskill)}`}
                      >
                        Practice 12Q
                      </a>
                      <a
                        className="text-xs underline text-gray-500 hover:text-black"
                        href={`/lesson/${encodeURIComponent(r.subskill)}`}
                      >
                        Lesson
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="text-xs text-gray-500">
              Tip: low confidence means small sample size — do 12Q twice before judging mastery.
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}