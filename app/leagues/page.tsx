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
  accuracy: number;
  points: number;
};

function pct(x: number | null | undefined) {
  return Math.round((x ?? 0) * 100);
}

function initials(name: string | null | undefined) {
  const clean = (name || "Student").trim();
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";
}

function didTrain(row: Entry | null) {
  return !!row && (row.answered > 0 || row.review_answered > 0);
}

function leagueBand(rank: number | null) {
  if (!rank) return "Unranked";
  if (rank <= 3) return "Pace setters";
  if (rank <= 10) return "Active pack";
  return "Building rhythm";
}

export default function LeaguesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      setErr(e?.message || "Failed to load community.");
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
    return rows.find((r) => r.user_id === userId) ?? null;
  }, [rows, userId]);

  const myRank = useMemo(() => {
    if (!userId) return null;
    const idx = rows.findIndex((r) => r.user_id === userId);
    return idx >= 0 ? idx + 1 : null;
  }, [rows, userId]);

  const topRows = useMemo(() => rows.slice(0, 50), [rows]);
  const suggestedCrew = useMemo(
    () => rows.filter((row) => row.user_id !== userId).slice(0, 4),
    [rows, userId]
  );

  const totalAnswered = useMemo(
    () => rows.reduce((sum, row) => sum + row.answered, 0),
    [rows]
  );
  const totalReviewed = useMemo(
    () => rows.reduce((sum, row) => sum + row.review_answered, 0),
    [rows]
  );
  const inviteCode = useMemo(() => (userId ? `ALGA-${userId.slice(0, 8).toUpperCase()}` : "ALGA"), [userId]);

  async function copyInvite() {
    const link =
      typeof window === "undefined"
        ? inviteCode
        : `${window.location.origin}/leagues?invite=${encodeURIComponent(inviteCode)}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Community"
        subtitle="Friends, shared streaks, and weekly accountability around the same Practice -> Review loop."
        right={<Pill text="Social layer" tone="accent" />}
      />

      {loading && (
        <Card title="Loading…" subtitle="Pulling the weekly community state">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Community could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={load}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && rows.length === 0 && (
        <Card title="No community signal yet" subtitle="A league starts once people train this week.">
          <div className="text-sm text-gray-700">
            Finish one practice or review session to create weekly activity.
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PrimaryButton href="/practice?subject=Reading">Start Practice</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && rows.length > 0 && (
        <div className="grid gap-4">
          <Card
            title="Your crew streak"
            subtitle="Shared streaks should create accountability, not empty competition."
            right={<Pill text={didTrain(myRow) ? "Checked in" : "Not checked in"} tone={didTrain(myRow) ? "success" : "accent"} />}
            accent
          >
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-[#c7dbff] bg-[#f6faff] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                      Today
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-black">
                      {didTrain(myRow) ? "Your side is done" : "Keep the streak alive"}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-gray-700">
                      {didTrain(myRow)
                        ? "You have contributed this week. Shared streaks work when both people train, so your side is handled."
                        : "Do one practice or review item before nudging friends. Accountability works better when you go first."}
                    </div>
                  </div>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#c7dbff] bg-white text-sm font-semibold text-[#004aad]">
                    {initials(myRow?.nickname)}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton href="/practice?subject=Reading">Train now</PrimaryButton>
                  <SecondaryButton href="/review">Clear review</SecondaryButton>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-semibold text-black">Invite friends</div>
                <div className="mt-2 text-sm leading-relaxed text-gray-700">
                  Share this with classmates you want in your weekly crew.
                </div>
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-sm text-gray-800">
                  {inviteCode}
                </div>
                <div className="mt-4 grid gap-3">
                  <PrimaryButton onClick={copyInvite}>
                    {copied ? "Invite copied" : "Copy invite link"}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Card title="Crew slots" subtitle="Five close accountability slots, not an infinite follower feed.">
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-xl border border-[#c7dbff] bg-[#f6faff] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#004aad] text-sm font-semibold text-white">
                      {initials(myRow?.nickname)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black">
                        {myRow?.nickname || "You"}
                      </div>
                      <div className="text-xs text-gray-600">
                        {didTrain(myRow) ? "Checked in this week" : "No training yet"}
                      </div>
                    </div>
                  </div>
                  <Pill text="You" tone="accent" />
                </div>

                {suggestedCrew.map((row) => (
                  <div key={row.user_id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                        {initials(row.nickname)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-black">
                          {row.nickname || "Student"}
                        </div>
                        <div className="text-xs text-gray-600">
                          {row.answered} answers • {row.review_answered} review
                        </div>
                      </div>
                    </div>
                    <Pill text="Active" tone={row.review_answered > 0 ? "success" : "neutral"} />
                  </div>
                ))}

                {Array.from({ length: Math.max(0, 4 - suggestedCrew.length) }).map((_, index) => (
                  <div key={`empty-${index}`} className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-700">Open friend slot</div>
                      <div className="mt-1 text-xs text-gray-500">Invite a student you actually study with.</div>
                    </div>
                    <Pill text="Open" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Weekly community pulse" subtitle="The league rewards useful SAT work, not score theater.">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatBox
                  label="Your rank"
                  value={myRank ? `#${myRank}` : "—"}
                  hint={leagueBand(myRank)}
                  accent
                />
                <StatBox
                  label="Answered"
                  value={String(totalAnswered)}
                  hint="Community attempts"
                />
                <StatBox
                  label="Review"
                  value={String(totalReviewed)}
                  hint="Recovery attempts"
                  accent={totalReviewed > 0}
                />
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                Best version of this page: friends keep each other consistent, while the leaderboard stays secondary and weekly.
              </div>
            </Card>
          </div>

          <Card title="Weekly league" subtitle="A light ranking layer for active students this week.">
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="grid grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Student</div>
                <div className="col-span-2 text-right">Work</div>
                <div className="col-span-2 text-right">Acc</div>
                <div className="col-span-2 text-right">Pts</div>
              </div>

              <ul className="divide-y divide-gray-200 bg-white">
                {topRows.map((entry, index) => {
                  const isMe = entry.user_id === userId;

                  return (
                    <li
                      key={entry.user_id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm ${isMe ? "bg-[#f6faff]" : ""}`}
                    >
                      <div className="col-span-1 font-semibold text-gray-600">{index + 1}</div>

                      <div className="col-span-5 min-w-0">
                        <div className={`truncate font-semibold ${isMe ? "text-[#004aad]" : "text-gray-900"}`}>
                          {entry.nickname || "Student"} {isMe ? <span className="text-xs text-gray-500">(you)</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-600">
                          review {entry.review_answered}
                        </div>
                      </div>

                      <div className="col-span-2 text-right text-gray-900">{entry.answered}</div>
                      <div className="col-span-2 text-right text-gray-900">{pct(entry.accuracy)}%</div>
                      <div className="col-span-2 text-right font-semibold text-gray-900">{Math.round(entry.points)}</div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SecondaryButton href="/today">Today</SecondaryButton>
              <SecondaryButton href="/skills">Skills</SecondaryButton>
              <SecondaryButton href="/coach">Coach</SecondaryButton>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
