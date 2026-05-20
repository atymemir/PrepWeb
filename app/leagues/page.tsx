'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

type Entry = {
  user_id: string;
  nickname: string;
  answered: number;
  correct: number;
  review_answered: number;
  accuracy: number; // 0..1
  points: number;
};

function pct(x: number | null | undefined) {
  return Math.round(((x ?? 0) * 100));
}

export default function LeaguesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("");
  const [rows, setRows] = useState<Entry[]>([]);

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

      const uid = sessionData.session.user.id;
      setUserId(uid);

      const { data: res, error } = await supabase.rpc("get_weekly_leaderboard");
      if (error) throw new Error(error.message);

      setRows((res ?? []) as Entry[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load leaderboard.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myRow = useMemo(() => {
    if (!userId) return null;
    return rows.find(r => r.user_id === userId) ?? null;
  }, [rows, userId]);

  const myRank = useMemo(() => {
    if (!userId) return null;
    const idx = rows.findIndex(r => r.user_id === userId);
    return idx >= 0 ? idx + 1 : null;
  }, [rows, userId]);

  const top50 = useMemo(() => rows.slice(0, 50), [rows]);

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Leagues"
        subtitle="Global weekly leaderboard. Points reward consistency + accuracy."
        right={<Pill text="Weekly" />}
      />

      <Card title="This week" subtitle="Your position in the global league.">
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
              No activity yet this week. Start a 12-question practice session to appear here.
            </div>
            <div className="mt-4 grid gap-3">
              <PrimaryButton href="/practice?subject=Reading">Start Practice (12Q)</PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && rows.length > 0 && (
          <div className="grid gap-4">
            {/* My row pinned */}
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-600">You</div>
                  <div className="mt-1 text-lg font-semibold">
                    {myRow?.nickname || "Student"} {myRank ? <span className="text-gray-500">· #{myRank}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {myRow
                      ? `answered ${myRow.answered} · review ${myRow.review_answered} · acc ${pct(myRow.accuracy)}%`
                      : "Do practice/review to enter the league."}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-600">Weekly points</div>
                  <div className="mt-1 text-2xl font-semibold">{myRow ? Math.round(myRow.points) : "—"}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <StatBox label="Answered" value={myRow ? String(myRow.answered) : "—"} hint="Practice attempts" />
                <StatBox label="Reviewed" value={myRow ? String(myRow.review_answered) : "—"} hint="Review attempts" />
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Points are derived from volume + accuracy. This is a weekly competition, not a SAT score claim.
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="grid grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Student</div>
                <div className="col-span-2 text-right">Answered</div>
                <div className="col-span-2 text-right">Acc</div>
                <div className="col-span-2 text-right">Points</div>
              </div>

              <ul className="divide-y divide-gray-200 bg-white">
                {top50.map((e, i) => {
                  const isMe = e.user_id === userId;
                  return (
                    <li
                      key={e.user_id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm ${
                        isMe ? "bg-gray-50" : ""
                      }`}
                    >
                      <div className="col-span-1 font-semibold text-gray-600">{i + 1}</div>

                      <div className="col-span-5">
                        <div className={`font-semibold ${isMe ? "text-black" : "text-gray-900"}`}>
                          {e.nickname || "Student"} {isMe ? <span className="text-xs text-gray-500">(you)</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-600">
                          review {e.review_answered}
                        </div>
                      </div>

                      <div className="col-span-2 text-right text-gray-900">{e.answered}</div>
                      <div className="col-span-2 text-right text-gray-900">{pct(e.accuracy)}%</div>
                      <div className="col-span-2 text-right font-semibold text-gray-900">{Math.round(e.points)}</div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex gap-4 text-sm">
              <a className="underline text-gray-700 hover:text-black" href="/today">Back to Today</a>
              <a className="underline text-gray-700 hover:text-black" href="/skills">Open Skills</a>
              <a className="underline text-gray-700 hover:text-black" href="/practice?subject=Reading">Practice</a>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}