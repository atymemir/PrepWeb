'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { errorMessage } from "../lib/errors";
import {
  createShareText,
  pointsToNextDivision,
  type EngagementIdentity,
  type EngagementStatus,
} from "../lib/engagement";
import { getDurableEngagementSnapshot } from "../lib/engagementDurable";
import { useStudentState } from "../lib/useStudentState";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import { IdentityStatusCard } from "../components/EngagementSystem";

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
  const { state: studentState } = useStudentState({ dueLimit: 80, historyLimit: 64 });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [resultCopied, setResultCopied] = useState(false);
  const [debtProofCopied, setDebtProofCopied] = useState(false);
  const [improvementProofCopied, setImprovementProofCopied] = useState(false);
  const [telegramCopied, setTelegramCopied] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [rows, setRows] = useState<Entry[]>([]);
  const [identity, setIdentity] = useState<EngagementIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<EngagementStatus | null>(null);
  const [engagementNotice, setEngagementNotice] = useState<string | null>(null);

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

      try {
        const snapshot = await getDurableEngagementSnapshot();
        setIdentity(snapshot.identity);
        setIdentityStatus(snapshot.status);
        setEngagementNotice(null);
      } catch (engagementErr: unknown) {
        setIdentity(null);
        setIdentityStatus(null);
        setEngagementNotice(errorMessage(engagementErr, "Durable engagement backend is unavailable."));
      }

      const { data: res, error } = await supabase.rpc("get_weekly_leaderboard");
      if (error) throw new Error(error.message);

      setRows((res ?? []) as Entry[]);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load community."));
      setRows([]);
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

  const pointsToClimb = useMemo(() => {
    if (!myRow || !myRank || myRank <= 1) return 0;
    const above = rows[myRank - 2];
    if (!above) return 0;
    return Math.max(1, Math.round(above.points - myRow.points + 1));
  }, [myRank, myRow, rows]);

  const pointsToTop10 = useMemo(() => {
    if (!myRow || !myRank || myRank <= 10 || rows.length < 10) return 0;
    const target = rows[9];
    if (!target) return 0;
    return Math.max(1, Math.round(target.points - myRow.points + 1));
  }, [myRank, myRow, rows]);

  const challengeText = useMemo(() => {
    const baseTarget = Math.max((myRow?.answered ?? 0) + 12, 24);
    const reviewTarget = Math.max((myRow?.review_answered ?? 0) + 4, 6);
    const accTarget = Math.max(70, Math.round((myRow?.accuracy ?? 0.6) * 100));
    return [
      "SAT crew challenge:",
      `Before week close, hit ${baseTarget} practice answers + ${reviewTarget} review answers at ${accTarget}%+ accuracy.`,
      "Loser posts next session result in Community.",
    ].join(" ");
  }, [myRow]);

  const resultText = useMemo(() => {
    if (!identity?.lastSession || !identityStatus) return "";

    return createShareText({
      nickname: myRow?.nickname || "Student",
      mode: identity.lastSession.mode,
      correct: identity.lastSession.correct,
      answered: identity.lastSession.answered,
      accuracyPct: identity.lastSession.accuracyPct,
      streakDays: identity.streakDays,
      level: identityStatus.level,
      division: identityStatus.division.label,
    });
  }, [identity, identityStatus, myRow]);

  const debtProofText = useMemo(() => {
    if (!studentState) return "Student state syncing. Finish one block to publish real debt-recovery proof.";
    if (studentState.reviewDebt.dueCount === 0) {
      return "I cleared my ALGA review debt to 0 today and moved back to focused SAT practice.";
    }
    return `I worked my recovery queue on ALGA and currently have ${studentState.reviewDebt.dueCount} due left. Keeping debt honest before new volume.`;
  }, [studentState]);

  const improvementProofText = useMemo(() => {
    if (!studentState) return "Student state syncing. Run one comparable block to unlock topic-improvement proof text.";
    const gain = studentState.recentMovement.biggestGain;
    if (gain) {
      return `I improved ${gain.topic} by +${gain.delta}% in my latest comparable SAT block on ALGA.`;
    }
    if (studentState.weakestSkill) {
      return `Working on ${studentState.weakestSkill.subskill} (${studentState.weakestSkill.accuracyPct}% right now) and pushing a focused retry next.`;
    }
    return "I finished a focused ALGA SAT block and I am replaying the same shape to produce clean movement proof.";
  }, [studentState]);

  const telegramBridgeText = useMemo(() => {
    return [
      "ALGA Telegram weekly challenge:",
      "1) Run one 12Q block",
      "2) Clear review debt",
      "3) Post your result screenshot and weakest-topic retry plan",
    ].join(" ");
  }, []);

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

  async function copyChallenge() {
    try {
      await navigator.clipboard.writeText(challengeText);
      setChallengeCopied(true);
      window.setTimeout(() => setChallengeCopied(false), 1600);
    } catch {
      setChallengeCopied(false);
    }
  }

  async function copyResult() {
    if (!resultText) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setResultCopied(true);
      window.setTimeout(() => setResultCopied(false), 1600);
    } catch {
      setResultCopied(false);
    }
  }

  async function copyDebtProof() {
    if (!debtProofText) return;
    try {
      await navigator.clipboard.writeText(debtProofText);
      setDebtProofCopied(true);
      window.setTimeout(() => setDebtProofCopied(false), 1600);
    } catch {
      setDebtProofCopied(false);
    }
  }

  async function copyImprovementProof() {
    if (!improvementProofText) return;
    try {
      await navigator.clipboard.writeText(improvementProofText);
      setImprovementProofCopied(true);
      window.setTimeout(() => setImprovementProofCopied(false), 1600);
    } catch {
      setImprovementProofCopied(false);
    }
  }

  async function copyTelegramBridge() {
    try {
      await navigator.clipboard.writeText(telegramBridgeText);
      setTelegramCopied(true);
      window.setTimeout(() => setTelegramCopied(false), 1600);
    } catch {
      setTelegramCopied(false);
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
          {identity && identityStatus && (
            <IdentityStatusCard
              identity={identity}
              status={identityStatus}
              title="Competitive identity"
              subtitle={`${identityStatus.division.label} • Level ${identityStatus.level}`}
              note="Community now ties directly to streak, division pressure, and visible SAT-work output."
            />
          )}

          {engagementNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {engagementNotice}
            </div>
          )}

          {studentState && (
            <Card
              title="Weekly climb command"
              subtitle="Community amplifies the same student-state loop, not separate behavior."
              right={<Pill text={`Debt ${studentState.reviewDebt.dueCount}`} tone={studentState.reviewDebt.dueCount > 0 ? "danger" : "success"} />}
              accent
            >
              <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-xl border border-[#c7dbff] bg-[#f6faff] p-4">
                  <div className="text-sm font-semibold text-black">{studentState.recommendedAction.title}</div>
                  <div className="mt-2 text-sm text-gray-700">{studentState.recommendedAction.reason}</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <PrimaryButton href={studentState.recommendedAction.primaryHref}>
                      {studentState.recommendedAction.primaryLabel}
                    </PrimaryButton>
                    <SecondaryButton href={studentState.recommendedAction.secondaryHref}>
                      {studentState.recommendedAction.secondaryLabel}
                    </SecondaryButton>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">What moves rank</div>
                  <div className="mt-2 text-sm text-gray-700">
                    Clear debt, then execute weakest-topic retry. Weekly rank follows real output, not passive leaderboard viewing.
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card
            title="Study proof cards"
            subtitle="Share concrete work proof: recovery, improvement, and session execution."
            right={<Pill text="Proof first" tone="accent" />}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Debt proof</div>
                <div className="mt-2 text-sm text-gray-700">{debtProofText}</div>
                <div className="mt-3">
                  <SecondaryButton onClick={copyDebtProof}>
                    {debtProofCopied ? "Copied" : "Copy debt proof"}
                  </SecondaryButton>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Improvement proof</div>
                <div className="mt-2 text-sm text-gray-700">{improvementProofText}</div>
                <div className="mt-3">
                  <SecondaryButton onClick={copyImprovementProof}>
                    {improvementProofCopied ? "Copied" : "Copy improvement proof"}
                  </SecondaryButton>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Session result</div>
                <div className="mt-2 text-sm text-gray-700">{resultText || "Finish one session to unlock result proof text."}</div>
                <div className="mt-3">
                  <SecondaryButton onClick={copyResult} disabled={!resultText}>
                    {resultCopied ? "Copied" : "Copy result proof"}
                  </SecondaryButton>
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Telegram bridge"
            subtitle="Light integration concept for real study groups without fake social mechanics."
            right={<Pill text="Bridge" tone="accent" />}
          >
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Weekly challenge script</div>
                <div className="mt-2">{telegramBridgeText}</div>
              </div>
              <div className="grid gap-3">
                <PrimaryButton onClick={copyTelegramBridge}>
                  {telegramCopied ? "Script copied" : "Copy Telegram script"}
                </PrimaryButton>
                <SecondaryButton onClick={copyInvite}>
                  {copied ? "Invite copied" : "Copy invite link"}
                </SecondaryButton>
                <SecondaryButton href="/today">Back to mission</SecondaryButton>
              </div>
            </div>
          </Card>

          <Card
            title="League pressure"
            subtitle="Concrete pressure beats passive ranking: know the exact score gap to chase."
            right={<Pill text={myRank ? `Rank #${myRank}` : "Unranked"} tone="accent" />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatBox
                label="Points to next rank"
                value={pointsToClimb > 0 ? String(pointsToClimb) : "—"}
                hint={pointsToClimb > 0 ? "Climb one place" : "You are already leading"}
                accent={pointsToClimb > 0}
              />
              <StatBox
                label="Points to Top 10"
                value={pointsToTop10 > 0 ? String(pointsToTop10) : "—"}
                hint={pointsToTop10 > 0 ? "Current weekly cutoff" : "Already Top 10"}
              />
              <StatBox
                label="Daily streak"
                value={identity ? `${identity.streakDays}d` : "—"}
                hint={identity ? `Best ${identity.bestStreakDays}d` : "No streak yet"}
                accent={(identity?.streakDays ?? 0) >= 3}
              />
              <StatBox
                label="Division gap"
                value={identity ? String(pointsToNextDivision(identity)) : "—"}
                hint={
                  identityStatus?.nextDivision
                    ? `XP to ${identityStatus.nextDivision.label}`
                    : "Top division"
                }
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PrimaryButton href="/practice?subject=Reading">Push practice points</PrimaryButton>
              <SecondaryButton href="/review">Push review points</SecondaryButton>
            </div>
          </Card>

          <Card
            title="Friend challenge loop"
            subtitle="Use direct challenge language to trigger return sessions from real classmates."
            right={<Pill text="Challenge ready" tone="accent" />}
          >
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              {challengeText}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <PrimaryButton onClick={copyChallenge}>
                {challengeCopied ? "Challenge copied" : "Copy challenge"}
              </PrimaryButton>
              <SecondaryButton onClick={copyInvite}>
                {copied ? "Invite copied" : "Copy invite link"}
              </SecondaryButton>
            </div>

            {resultText && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Latest session result
                </div>
                <div className="mt-2 text-sm leading-relaxed text-gray-700">{resultText}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                  <PrimaryButton onClick={copyResult}>
                    {resultCopied ? "Result copied" : "Copy result message"}
                  </PrimaryButton>
                  <SecondaryButton href="/today">Return to Today</SecondaryButton>
                </div>
              </div>
            )}
          </Card>

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
