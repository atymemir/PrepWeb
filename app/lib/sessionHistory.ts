import { getSupabase } from "./supabase";

export type StudySessionMode = "practice" | "review" | "exam";

export type SessionTopicSnapshot = {
  subject: string | null;
  topic: string;
  correctCount: number;
  totalCount: number;
};

export type StudySessionRecord = {
  id: string;
  userId: string;
  clientSessionId: string;
  mode: StudySessionMode;
  variant: string | null;
  subject: string | null;
  subskill: string | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  accuracyPct: number;
  durationSeconds: number;
  outcome: string | null;
  scoreBandLow: number | null;
  scoreBandHigh: number | null;
  createdAt: string;
  topics: Array<{
    subject: string | null;
    topic: string;
    correctCount: number;
    totalCount: number;
    accuracyPct: number;
  }>;
};

function safeRound(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function pct(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
}

async function requireUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id;
  if (!userId) throw new Error("You need to sign in.");
  return { supabase, userId };
}

export async function recordStudySession(input: {
  clientSessionId: string;
  mode: StudySessionMode;
  variant?: string | null;
  subject?: string | null;
  subskill?: string | null;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  durationSeconds: number;
  outcome?: string | null;
  scoreBandLow?: number | null;
  scoreBandHigh?: number | null;
  topics?: SessionTopicSnapshot[];
}): Promise<{ sessionId: string }> {
  const { supabase, userId } = await requireUser();

  const row = {
    user_id: userId,
    client_session_id: input.clientSessionId,
    mode: input.mode,
    variant: input.variant ?? null,
    subject: input.subject ?? null,
    subskill: input.subskill ?? null,
    total_questions: Math.max(0, safeRound(input.totalQuestions)),
    answered_count: Math.max(0, safeRound(input.answeredCount)),
    correct_count: Math.max(0, safeRound(input.correctCount)),
    accuracy_pct: pct(input.correctCount, input.answeredCount),
    duration_seconds: Math.max(0, safeRound(input.durationSeconds)),
    outcome: input.outcome ?? null,
    score_band_low: input.scoreBandLow ?? null,
    score_band_high: input.scoreBandHigh ?? null,
  };

  let sessionId = "";
  const inserted = await supabase
    .from("study_sessions")
    .insert(row)
    .select("id")
    .single();

  if (inserted.error) {
    const msg = inserted.error.message.toLowerCase();
    if (!msg.includes("duplicate") && inserted.error.code !== "23505") {
      throw new Error(inserted.error.message);
    }
    const existing = await supabase
      .from("study_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("mode", input.mode)
      .eq("client_session_id", input.clientSessionId)
      .single();
    if (existing.error) throw new Error(existing.error.message);
    sessionId = String(existing.data.id);
  } else {
    sessionId = String(inserted.data.id);
  }

  if (input.topics && input.topics.length > 0) {
    const normalized = input.topics
      .map((topic) => ({
        session_id: sessionId,
        user_id: userId,
        mode: input.mode,
        subject: topic.subject ?? null,
        topic: (topic.topic || "Unknown").trim() || "Unknown",
        correct_count: Math.max(0, safeRound(topic.correctCount)),
        total_count: Math.max(0, safeRound(topic.totalCount)),
      }))
      .filter((topic) => topic.total_count > 0)
      .map((topic) => ({
        ...topic,
        accuracy_pct: pct(topic.correct_count, topic.total_count),
      }));

    await supabase.from("study_session_topics").delete().eq("session_id", sessionId);

    if (normalized.length > 0) {
      const insTopics = await supabase.from("study_session_topics").insert(normalized);
      if (insTopics.error) throw new Error(insTopics.error.message);
    }
  }

  return { sessionId };
}

function mapSessionRow(row: any): StudySessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clientSessionId: String(row.client_session_id),
    mode: row.mode as StudySessionMode,
    variant: row.variant ?? null,
    subject: row.subject ?? null,
    subskill: row.subskill ?? null,
    totalQuestions: safeRound(row.total_questions),
    answeredCount: safeRound(row.answered_count),
    correctCount: safeRound(row.correct_count),
    accuracyPct: safeRound(row.accuracy_pct),
    durationSeconds: safeRound(row.duration_seconds),
    outcome: row.outcome ?? null,
    scoreBandLow: row.score_band_low ?? null,
    scoreBandHigh: row.score_band_high ?? null,
    createdAt: String(row.created_at),
    topics: [],
  };
}

export async function getStudySessions(limit = 80): Promise<StudySessionRecord[]> {
  const { supabase, userId } = await requireUser();
  const sessionsRes = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  const sessions = (sessionsRes.data ?? []).map(mapSessionRow);
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const topicsRes = await supabase
    .from("study_session_topics")
    .select("*")
    .in("session_id", ids)
    .order("created_at", { ascending: false });
  if (topicsRes.error) throw new Error(topicsRes.error.message);

  const topicsBySession = new Map<string, StudySessionRecord["topics"]>();
  for (const topic of topicsRes.data ?? []) {
    const key = String(topic.session_id);
    if (!topicsBySession.has(key)) topicsBySession.set(key, []);
    topicsBySession.get(key)!.push({
      subject: topic.subject ?? null,
      topic: String(topic.topic),
      correctCount: safeRound(topic.correct_count),
      totalCount: safeRound(topic.total_count),
      accuracyPct: safeRound(topic.accuracy_pct),
    });
  }

  return sessions.map((session) => ({
    ...session,
    topics: topicsBySession.get(session.id) ?? [],
  }));
}

export function buildSessionAnalytics(sessions: StudySessionRecord[]) {
  const practice = sessions.filter((s) => s.mode === "practice" || s.mode === "exam");
  const review = sessions.filter((s) => s.mode === "review");

  const topicBuckets = new Map<string, Array<{ at: string; acc: number; total: number; mode: StudySessionMode }>>();
  for (const session of sessions) {
    for (const topic of session.topics) {
      const key = topic.topic.trim() || "Unknown";
      if (!topicBuckets.has(key)) topicBuckets.set(key, []);
      topicBuckets.get(key)!.push({
        at: session.createdAt,
        acc: topic.accuracyPct,
        total: topic.totalCount,
        mode: session.mode,
      });
    }
  }

  const topicMovement = [...topicBuckets.entries()]
    .map(([topic, rows]) => {
      const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      return {
        topic,
        firstAcc: first.acc,
        lastAcc: last.acc,
        delta: last.acc - first.acc,
        samples: sorted.length,
      };
    })
    .filter((row) => row.samples >= 2)
    .sort((a, b) => a.delta - b.delta);

  const weakTopicTrend = topicMovement.slice(0, 4);

  const latestReview = review.slice(0, 4);
  const prevReview = review.slice(4, 8);
  const avg = (rows: StudySessionRecord[]) =>
    rows.length ? Math.round(rows.reduce((sum, row) => sum + row.accuracyPct, 0) / rows.length) : null;
  const latestReviewAvg = avg(latestReview);
  const prevReviewAvg = avg(prevReview);

  const stability = {
    practiceAvg: avg(practice.slice(0, 8)),
    reviewAvg: avg(review.slice(0, 8)),
    practiceRange: practice.length
      ? Math.max(...practice.slice(0, 8).map((s) => s.accuracyPct)) -
        Math.min(...practice.slice(0, 8).map((s) => s.accuracyPct))
      : null,
    reviewRange: review.length
      ? Math.max(...review.slice(0, 8).map((s) => s.accuracyPct)) -
        Math.min(...review.slice(0, 8).map((s) => s.accuracyPct))
      : null,
  };

  return {
    weakTopicTrend,
    reviewRecoveryTrend: {
      latestAvg: latestReviewAvg,
      previousAvg: prevReviewAvg,
      delta:
        latestReviewAvg !== null && prevReviewAvg !== null
          ? latestReviewAvg - prevReviewAvg
          : null,
    },
    stability,
    topicMovement: topicMovement.slice(0, 10),
  };
}
