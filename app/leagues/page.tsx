'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

type Entry = {
  user_id: string;
  nickname: string;
  answered: number;
  correct: number;
  review_answered: number;
  accuracy: number; // 0..1
  points: number;
};

export default function LeaguesPage() {

  const supabase = getSupabase();
  const router = useRouter();
  const [rows, setRows] = useState<Entry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.push("/login");

      const { data: res, error } = await supabase.rpc("get_weekly_leaderboard");
      if (error) return setErr(error.message);
      setRows((res ?? []) as Entry[]);
    })();
  }, [router]);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Leagues</h1>
      <p className="text-sm text-gray-600 mt-1">Global weekly leaderboard.</p>

      <div className="mt-6 rounded-2xl border bg-white shadow-sm">
        {err && <div className="p-4 text-sm text-red-600">{err}</div>}
        {!err && rows.length === 0 && <div className="p-4 text-sm text-gray-600">No activity yet this week.</div>}

        <ul>
          {rows.slice(0, 50).map((e, i) => (
            <li key={e.user_id} className="flex justify-between px-4 py-3 border-b last:border-b-0">
              <div>
                <div className="font-medium">{e.nickname || "Student"}</div>
                <div className="text-xs text-gray-600">
                  #{i + 1} • answered {e.answered} • review {e.review_answered} • acc {Math.round((e.accuracy ?? 0) * 100)}%
                </div>
              </div>
              <div className="font-semibold">{Math.round(e.points)} pts</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
