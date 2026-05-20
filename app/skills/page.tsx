'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

type Row = {
  domain: string;
  skill: string;
  subskill: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
};

export default function SkillsPage() {
  const router = useRouter();
  const [subject, setSubject] = useState<"Math" | "Reading">("Reading");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const supabase = getSupabase();

      const { data, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);
      if (!data.session) {
        router.push("/login");
        return;
      }

      const { data: res, error } = await supabase.rpc("get_skill_mastery", { p_subject: subject });
      if (error) throw new Error(error.message);

      setRows((res ?? []) as Row[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load skills.");
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Skills</h1>
          <p className="text-sm text-gray-600 mt-1">Mastery map.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSubject("Reading")}
            className={`px-3 py-2 rounded-lg border text-sm ${subject==="Reading" ? "bg-black text-white" : "bg-white"}`}
          >
            Reading
          </button>
          <button
            onClick={() => setSubject("Math")}
            className={`px-3 py-2 rounded-lg border text-sm ${subject==="Math" ? "bg-black text-white" : "bg-white"}`}
          >
            Math
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white shadow-sm">
        {err && <div className="p-4 text-sm text-red-600">{err}</div>}
        {!err && rows.length === 0 && (
          <div className="p-4 text-sm text-gray-600">
            No data yet. Do practice first.
          </div>
        )}

        <ul>
          {rows.slice(0, 80).map((r, i) => (
            <li key={i} className="flex justify-between px-4 py-3 border-b last:border-b-0">
              <div>
                <div className="font-medium">{r.subskill}</div>
                <div className="text-xs text-gray-600">
                  {r.domain} • {r.skill} • {Math.round((r.accuracy ?? 0) * 100)}% (n={r.attempts})
                </div>
              </div>
              <a
                className="text-sm underline"
                href={`/practice?subject=${subject}&subskill=${encodeURIComponent(r.subskill)}`}
              >
                Practice 12Q
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}