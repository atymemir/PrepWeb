import { getSupabase } from "./supabase";
import { describeStatus, type EngagementIdentity, type EngagementStatus, type SessionMode, type SessionPayoff } from "./engagement";

export type DurableEngagementSnapshot = {
  identity: EngagementIdentity;
  status: EngagementStatus;
};

export type DurableSessionRecordResult = {
  identity: EngagementIdentity;
  status: EngagementStatus;
  payoff: SessionPayoff;
  duplicate: boolean;
};

type ProfileRow = {
  streak_days: number | null;
  best_streak_days: number | null;
  lifetime_xp: number | null;
  total_sessions: number | null;
  completed_sessions: number | null;
  total_answers: number | null;
  total_correct: number | null;
  last_active_on: string | null;
  last_session_mode: string | null;
  last_session_accuracy_pct: number | null;
  last_session_xp_awarded: number | null;
  last_session_completed_at: string | null;
  last_session_answered: number | null;
  last_session_correct: number | null;
  last_session_total: number | null;
  last_session_best_streak: number | null;
};

type RecordRow = ProfileRow & {
  duplicate: boolean | null;
  base_xp: number | null;
  completion_bonus: number | null;
  accuracy_bonus: number | null;
  xp_awarded: number | null;
  completed: boolean | null;
  accuracy_pct: number | null;
};

function safeInt(x: number | null | undefined): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.round(Number(x)));
}

function normalizeSessionMode(mode: string | null | undefined): SessionMode {
  return mode === "review" ? "review" : "practice";
}

function identityFromRow(userId: string, row: ProfileRow | null): EngagementIdentity {
  if (!row) {
    return {
      userId,
      streakDays: 0,
      bestStreakDays: 0,
      lifetimeXp: 0,
      totalSessions: 0,
      completedSessions: 0,
      totalAnswers: 0,
      totalCorrect: 0,
      lastActiveDate: null,
      lastSession: null,
    };
  }

  const hasLastSession = !!row.last_session_completed_at;

  return {
    userId,
    streakDays: safeInt(row.streak_days),
    bestStreakDays: safeInt(row.best_streak_days),
    lifetimeXp: safeInt(row.lifetime_xp),
    totalSessions: safeInt(row.total_sessions),
    completedSessions: safeInt(row.completed_sessions),
    totalAnswers: safeInt(row.total_answers),
    totalCorrect: safeInt(row.total_correct),
    lastActiveDate: row.last_active_on || null,
    lastSession: hasLastSession
      ? {
          mode: normalizeSessionMode(row.last_session_mode),
          accuracyPct: safeInt(row.last_session_accuracy_pct),
          xpAwarded: safeInt(row.last_session_xp_awarded),
          completedAt: row.last_session_completed_at || new Date().toISOString(),
          answered: safeInt(row.last_session_answered),
          correct: safeInt(row.last_session_correct),
          total: safeInt(row.last_session_total),
          bestStreak: safeInt(row.last_session_best_streak),
        }
      : null,
  };
}

function rpcMissing(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return msg.includes("record_engagement_session") || msg.includes("get_my_engagement_profile");
}

function requireAuthUserId(): Promise<string> {
  const supabase = getSupabase();
  return supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) throw new Error(error.message);
      if (!data.session?.user.id) throw new Error("You need to sign in.");
      return data.session.user.id;
    });
}

export async function getDurableEngagementSnapshot(): Promise<DurableEngagementSnapshot> {
  const userId = await requireAuthUserId();
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("get_my_engagement_profile");
  if (error) {
    if (rpcMissing(error.message)) {
      throw new Error("Durable engagement backend is not deployed yet.");
    }
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as ProfileRow | null;
  const identity = identityFromRow(userId, row);
  return { identity, status: describeStatus(identity) };
}

export async function recordDurableEngagementSession(input: {
  clientSessionId: string;
  mode: SessionMode;
  answered: number;
  correct: number;
  total: number;
}): Promise<DurableSessionRecordResult> {
  const userId = await requireAuthUserId();
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("record_engagement_session", {
    p_client_session_id: input.clientSessionId,
    p_mode: input.mode,
    p_answered: input.answered,
    p_correct: input.correct,
    p_total: input.total,
  });

  if (error) {
    if (rpcMissing(error.message)) {
      throw new Error("Durable engagement backend is not deployed yet.");
    }
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as RecordRow | null;
  const identity = identityFromRow(userId, row);
  const status = describeStatus(identity);

  const payoff: SessionPayoff = {
    baseXp: safeInt(row?.base_xp),
    completionBonus: safeInt(row?.completion_bonus),
    accuracyBonus: safeInt(row?.accuracy_bonus),
    totalAwarded: safeInt(row?.xp_awarded),
    completed: !!row?.completed,
    accuracyPct: safeInt(row?.accuracy_pct),
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("alga-engagement-updated", {
        detail: {
          userId,
          streakDays: identity.streakDays,
          division: status.division.label,
          level: status.level,
        },
      })
    );
  }

  return {
    identity,
    status,
    payoff,
    duplicate: !!row?.duplicate,
  };
}
