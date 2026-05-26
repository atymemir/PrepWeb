'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { analyzeReviewSession, type SessionAnalysis } from "../lib/sessionAnalysis";
import { requestQuestionExplanation, type AiExplanation } from "../lib/questionExplanation";
import { errorMessage } from "../lib/errors";
import { recordAnswerEvent } from "../lib/answerEvents";
import {
  applyMomentumAnswer,
  createMomentum,
  createShareText,
  pointsToNextDivision,
  type EngagementIdentity,
  type EngagementStatus,
  type SessionMomentum,
  type SessionPayoff,
} from "../lib/engagement";
import {
  getDurableEngagementSnapshot,
  recordDurableEngagementSession,
} from "../lib/engagementDurable";
import { recordStudySession } from "../lib/sessionHistory";
import { focusedLessonHref, focusedPracticeHref } from "../lib/mastery";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import QuestionActionBlock from "../components/QuestionActionBlock";
import { SessionPayoffCard } from "../components/EngagementSystem";

type Question = {
  id: string;
  subject: string;
  topic: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  difficulty_level: number | null;
};

type ReviewAnswer = {
  selected: string;
  correct: boolean;
  subject: string;
  topic: string | null;
};

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function queueLabel(n: number) {
  if (n === 0) return "Clear";
  if (n <= 4) return "Light queue";
  if (n <= 8) return "Moderate queue";
  return "Heavy queue";
}

function topicKey(topic: string | null) {
  return topic?.trim() || "Unknown";
}

function createClientSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function reviewReasonFor(args: {
  question: Question;
  questions: Question[];
  answers: Record<string, ReviewAnswer>;
}): "new mistake" | "failed recovery" | "low-confidence recovery" | "repeated relapse" {
  const topic = topicKey(args.question.topic);
  const topicAnswers = Object.values(args.answers).filter((answer) => topicKey(answer.topic) === topic);
  if (topicAnswers.some((answer) => !answer.correct)) return "failed recovery";
  if (topic === "Unknown") return "low-confidence recovery";
  if (args.questions.filter((question) => topicKey(question.topic) === topic).length > 1) {
    return "repeated relapse";
  }
  return "new mistake";
}

function reviewReasonLabel(
  reason: "new mistake" | "failed recovery" | "low-confidence recovery" | "repeated relapse"
): string {
  if (reason === "failed recovery") return "Failed recovery";
  if (reason === "repeated relapse") return "Repeated relapse";
  if (reason === "low-confidence recovery") return "Low confidence";
  return "New mistake";
}

function reviewReasonTone(
  reason: "new mistake" | "failed recovery" | "low-confidence recovery" | "repeated relapse"
): "neutral" | "accent" | "danger" {
  if (reason === "failed recovery" || reason === "repeated relapse") return "danger";
  if (reason === "low-confidence recovery") return "accent";
  return "neutral";
}

export default function ReviewPage() {
  const router = useRouter();
  const limit = 12;

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"ready" | "in_session" | "done">("ready");
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctOption: string } | null>(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);
  const [aiExplain, setAiExplain] = useState<AiExplanation | null>(null);

  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [answers, setAnswers] = useState<
    Record<
      string,
      {
        selected: string;
        correct: boolean;
        topic: string | null;
        subject: string;
      }
    >
  >({});
  const [saving, setSaving] = useState(false);
  const [identity, setIdentity] = useState<EngagementIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<EngagementStatus | null>(null);
  const [momentum, setMomentum] = useState<SessionMomentum>(() => createMomentum(limit));
  const [sessionPayoff, setSessionPayoff] = useState<SessionPayoff | null>(null);
  const [shareText, setShareText] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [sessionClientId, setSessionClientId] = useState<string>(() => createClientSessionId());
  const [engagementNotice, setEngagementNotice] = useState<string | null>(null);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const [reviewStartedAtMs, setReviewStartedAtMs] = useState<number>(() => Date.now());
  const [finalAnalysis, setFinalAnalysis] = useState<SessionAnalysis | null>(null);
  const [queueStartCount, setQueueStartCount] = useState<number | null>(null);
  const [queueAfterCount, setQueueAfterCount] = useState<number | null>(null);
  const [postSessionNotice, setPostSessionNotice] = useState<string | null>(null);

  const lastSubmitRef = useRef<{
    questionId: string;
    selected: string;
    timeTaken: number;
  } | null>(null);

  const q = questions[idx];
  const total = questions.length;

  const reviewAnalysis = useMemo(() => {
    return analyzeReviewSession(
      Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        subject: value.subject,
        topic: value.topic,
        correct: value.correct,
      }))
    );
  }, [answers]);

  const analysis = finalAnalysis ?? reviewAnalysis;
  const accuracyPct = analysis.accuracyPct;

  const queueTone = useMemo(() => {
    if (questions.length === 0) return "success" as const;
    if (questions.length <= 4) return "accent" as const;
    if (questions.length <= 8) return "accent" as const;
    return "danger" as const;
  }, [questions.length]);

  const currentReviewReason = useMemo(() => {
    if (!q) return null;
    return reviewReasonFor({ question: q, questions, answers });
  }, [q, questions, answers]);

  const repairTopic = analysis.primaryRepairTarget?.topic ?? null;
  const repairSubject = useMemo(() => {
    if (!repairTopic) return "Reading";
    const found = Object.values(answers).find(
      (answer) => (answer.topic?.trim() || "Unknown") === repairTopic
    );
    return (found?.subject as "Reading" | "Math") || "Reading";
  }, [answers, repairTopic]);

  const repairLessonHref = useMemo(() => {
    if (!repairTopic) return "/lessons";
    return focusedLessonHref(repairTopic);
  }, [repairTopic]);

  const repairPracticeHref = useMemo(() => {
    if (!repairTopic) return "/practice?subject=Reading";
    return focusedPracticeHref(repairSubject, repairTopic, true);
  }, [repairTopic, repairSubject]);

  const outcomePill = useMemo(() => {
    if (analysis.outcome === "rebuild") {
      return { text: "Rebuild", tone: "danger" as const };
    }
    if (analysis.outcome === "stabilize") {
      return { text: "Stabilize", tone: "accent" as const };
    }
    return { text: "Advance", tone: "success" as const };
  }, [analysis.outcome]);

  const queueTopicBuckets = useMemo(() => {
    const buckets = new Map<string, { topic: string; subject: string; count: number }>();
    for (const question of questions) {
      const topic = topicKey(question.topic);
      const key = `${question.subject}:${topic}`;
      if (!buckets.has(key)) {
        buckets.set(key, { topic, subject: question.subject || "Reading", count: 0 });
      }
      buckets.get(key)!.count += 1;
    }
    return [...buckets.values()].sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.topic.localeCompare(b.topic);
    });
  }, [questions]);

  const queueSubjectBuckets = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const question of questions) {
      const subject = question.subject || "Reading";
      buckets.set(subject, (buckets.get(subject) ?? 0) + 1);
    }
    return [...buckets.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);
  }, [questions]);

  const liveRemainingDebt = useMemo(
    () => Math.max(total - analysis.reviewedCount, 0),
    [total, analysis.reviewedCount]
  );

  const recoveryRatePct = useMemo(() => {
    if (analysis.reviewedCount === 0) return 0;
    return Math.round((analysis.correctCount / analysis.reviewedCount) * 100);
  }, [analysis.correctCount, analysis.reviewedCount]);

  const debtDelta = useMemo(() => {
    if (queueStartCount === null || queueAfterCount === null) return null;
    return queueStartCount - queueAfterCount;
  }, [queueAfterCount, queueStartCount]);

  const nextRecoveryRoute = useMemo(() => {
    if ((queueAfterCount ?? 0) > 0) {
      return {
        note: "Recovery queue still has due items. Keep clearing debt before forward volume.",
        primaryHref: "/review",
        primaryLabel: "Continue recovery queue",
        secondaryHref: repairPracticeHref,
        secondaryLabel: "Target failed topic",
      };
    }

    if (analysis.outcome === "rebuild") {
      return {
        note: "Rebuild route: lesson first, then targeted practice.",
        primaryHref: repairLessonHref,
        primaryLabel: "Open lesson",
        secondaryHref: repairPracticeHref,
        secondaryLabel: "Run targeted practice",
      };
    }

    if (analysis.outcome === "stabilize") {
      return {
        note: "Stabilize route: one focused practice set on failed topic.",
        primaryHref: repairPracticeHref,
        primaryLabel: "Run targeted practice",
        secondaryHref: "/review",
        secondaryLabel: "Re-check due queue",
      };
    }

    return {
      note: "Advance route: return to forward practice, keep review active.",
      primaryHref: "/practice?subject=Reading",
      primaryLabel: "Return to practice",
      secondaryHref: "/review",
      secondaryLabel: "Check due queue",
    };
  }, [queueAfterCount, repairPracticeHref, analysis.outcome, repairLessonHref]);

  const failedTopicRoutes = useMemo(() => {
    return analysis.failedTopics.slice(0, 2).map((topic) => {
      const match = Object.values(answers).find(
        (answer) => (answer.topic?.trim() || "Unknown") === topic.topic
      );
      const subject = (match?.subject as "Reading" | "Math") || "Reading";
      return {
        ...topic,
        subject,
        practiceHref: focusedPracticeHref(subject, topic.topic, true),
        lessonHref: focusedLessonHref(topic.topic),
      };
    });
  }, [answers, analysis.failedTopics]);

  function optionText(letter: string) {
    if (!q) return "";
    switch (letter) {
      case "A": return q.option_a;
      case "B": return q.option_b;
      case "C": return q.option_c;
      case "D": return q.option_d;
      default: return "";
    }
  }

  function resetQuestionUI() {
    setSelected(null);
    setLocked(false);
    setFeedback(null);
    setAiExplain(null);
    setAiExplainError(null);
    setAiExplainLoading(false);
    setStartedAt(Date.now());
  }

  async function ensureAuth() {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);

    if (!data.session) {
      router.push("/login");
      return null;
    }

    return data.session.user.id;
  }

  async function loadDuePreview() {
    setLoading(true);
    setErr(null);
    setMode("ready");
    setQuestions([]);
    setIdx(0);
    resetQuestionUI();
    setAnswers({});
    setHistorySessionId(null);
    setFinalAnalysis(null);
    setQueueAfterCount(null);
    setPostSessionNotice(null);
    lastSubmitRef.current = null;

    try {
      const uid = await ensureAuth();
      if (uid) {
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
      }

      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("get_due_review_questions", { p_limit: limit });
      if (error) throw new Error(error.message);

      const list = (data ?? []) as Question[];
      setQuestions(list);
      setQueueStartCount(list.length);
      setMomentum(createMomentum(list.length || limit));
      setSessionPayoff(null);
      setShareText("");
      setCopiedShare(false);
      setSessionClientId(createClientSessionId());
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load review queue."));
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    if (!questions.length) return;
    setMode("in_session");
    setIdx(0);
    setMomentum(createMomentum(questions.length || limit));
    setSessionPayoff(null);
    setShareText("");
    setCopiedShare(false);
    setSessionClientId(createClientSessionId());
    setHistorySessionId(null);
    setReviewStartedAtMs(Date.now());
    setQueueStartCount(questions.length);
    setFinalAnalysis(null);
    setQueueAfterCount(null);
    setPostSessionNotice(null);
    resetQuestionUI();
    setAnswers({});
    lastSubmitRef.current = null;
  }

  function buildTopicSnapshots(source: Record<string, { selected: string; correct: boolean; topic: string | null; subject: string }>) {
    const buckets = new Map<string, { subject: string | null; correct: number; total: number }>();
    for (const answer of Object.values(source)) {
      const key = (answer.topic?.trim() || "Unknown");
      if (!buckets.has(key)) {
        buckets.set(key, { subject: answer.subject || null, correct: 0, total: 0 });
      }
      const bucket = buckets.get(key)!;
      bucket.total += 1;
      if (answer.correct) bucket.correct += 1;
    }
    return [...buckets.entries()].map(([topic, value]) => ({
      topic,
      subject: value.subject,
      correctCount: value.correct,
      totalCount: value.total,
    }));
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (!cancelled) await loadDuePreview();
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(letter: string) {
    if (locked || saving) return;
    setSelected(letter);
  }

  async function submit() {
    if (!q || !selected || locked) return;

    setSaving(true);
    setErr(null);

    try {
      const timeTaken = clampInt(Math.round((Date.now() - startedAt) / 1000), 0, 60 * 60);
      const selectedOpt = selected.toUpperCase();

      lastSubmitRef.current = {
        questionId: q.id,
        selected: selectedOpt,
        timeTaken,
      };

      const recorded = await recordAnswerEvent({
        questionId: q.id,
        selectedOption: selectedOpt,
        mode: "review",
        timeTakenSeconds: timeTaken,
      });

      setAnswers((prev) => ({
        ...prev,
        [q.id]: {
          selected: recorded.selectedOption,
          correct: recorded.isCorrect,
          topic: q.topic ?? null,
          subject: q.subject,
        },
      }));

      setFeedback({
        correct: recorded.isCorrect,
        correctOption: recorded.correctOption || String(q.correct_option).toUpperCase(),
      });

      setMomentum((prev) =>
        applyMomentumAnswer(prev, {
          correct: recorded.isCorrect,
          difficultyLevel: q.difficulty_level,
        })
      );
      setLocked(true);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to record review answer."));
    } finally {
      setSaving(false);
    }
  }

  async function retryRecord() {
    if (!lastSubmitRef.current) return;

    setSaving(true);
    setErr(null);

    try {
      const t = lastSubmitRef.current;
      const recorded = await recordAnswerEvent({
        questionId: t.questionId,
        selectedOption: t.selected,
        mode: "review",
        timeTakenSeconds: t.timeTaken,
      });

      const correctOpt = recorded.correctOption || String(q?.correct_option || "-").toUpperCase();

      setAnswers((prev) => ({
        ...prev,
        [t.questionId]: {
          selected: recorded.selectedOption,
          correct: recorded.isCorrect,
          topic: q?.topic ?? null,
          subject: q?.subject ?? "Reading",
        },
      }));

      setFeedback({ correct: recorded.isCorrect, correctOption: correctOpt });
      setMomentum((prev) =>
        applyMomentumAnswer(prev, {
          correct: recorded.isCorrect,
          difficultyLevel: q?.difficulty_level,
        })
      );
      setLocked(true);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Retry failed."));
    } finally {
      setSaving(false);
    }
  }

  async function generateAiExplanation() {
    if (!q || !selected || aiExplainLoading) return;

    setAiExplainLoading(true);
    setAiExplainError(null);

    try {
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You need to sign in.");
      }

      const data = await requestQuestionExplanation(session.access_token, {
        subject: q.subject,
        subskill: q.topic || null,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option.toUpperCase(),
        selected_option: selected.toUpperCase(),
        explanation: q.explanation ?? null,
      });

      setAiExplain(data);
    } catch (e: unknown) {
      setAiExplainError(errorMessage(e, "Failed to generate AI explanation."));
    } finally {
      setAiExplainLoading(false);
    }
  }

  async function finishReviewSession() {
    const source = { ...answers };
    const answered = Object.keys(source).length;
    const correct = Object.values(source).filter((answer) => answer.correct).length;
    const sourceAnalysis = analyzeReviewSession(
      Object.entries(source).map(([questionId, value]) => ({
        questionId,
        subject: value.subject,
        topic: value.topic,
        correct: value.correct,
      }))
    );
    setFinalAnalysis(sourceAnalysis);
    setPostSessionNotice(null);

    try {
      const applied = await recordDurableEngagementSession({
        clientSessionId: sessionClientId,
        mode: "review",
        answered,
        correct,
        total,
      });

      setIdentity(applied.identity);
      setIdentityStatus(applied.status);
      setSessionPayoff(applied.payoff);
      setEngagementNotice(null);

      setShareText(
        createShareText({
          nickname: "Student",
          mode: "review",
          correct,
          answered,
          accuracyPct: applied.payoff.accuracyPct,
          streakDays: applied.identity.streakDays,
          level: applied.status.level,
          division: applied.status.division.label,
        })
      );

      const history = await recordStudySession({
        clientSessionId: sessionClientId,
        mode: "review",
        variant: "recovery",
        subject: "Mixed",
        subskill: repairTopic || null,
        totalQuestions: total,
        answeredCount: answered,
        correctCount: correct,
        durationSeconds: Math.max(0, Math.round((Date.now() - reviewStartedAtMs) / 1000)),
        outcome: sourceAnalysis.outcome,
        topics: buildTopicSnapshots(source),
      });
      setHistorySessionId(history.sessionId);

      try {
        const supabase = getSupabase();
        const dueRes = await supabase.rpc("get_due_review_questions", { p_limit: 120 });
        if (dueRes.error) throw new Error(dueRes.error.message);
        setQueueAfterCount(((dueRes.data ?? []) as Question[]).length);
      } catch (postErr: unknown) {
        setQueueAfterCount(null);
        setPostSessionNotice(errorMessage(postErr, "Post-session queue snapshot is unavailable."));
      }
    } catch (e: unknown) {
      setSessionPayoff(null);
      setEngagementNotice(
        errorMessage(e, "Session results were saved, but durable engagement sync failed.")
      );
    }

    setMode("done");
  }

  async function nextOrFinish() {
    if (!q) return;

    const isLast = idx >= questions.length - 1;
    if (isLast) {
      await finishReviewSession();
      return;
    }

    setIdx((i) => i + 1);
    resetQuestionUI();
    lastSubmitRef.current = null;
  }

  function previousQuestion() {
    if (idx <= 0) return;
    setIdx((i) => Math.max(0, i - 1));
    resetQuestionUI();
    lastSubmitRef.current = null;
  }

  async function copyShareResult() {
    if (!shareText) return;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 1600);
    } catch {
      setCopiedShare(false);
    }
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Recovery workflow"
        title="Review"
        subtitle="Clear due mistakes before you push new practice."
        right={
          <button
            onClick={() => router.push("/today")}
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
          >
            Back
          </button>
        }
      />

      {!loading && !err && (
        <LoopRail
          active="Review"
          note="Review clears active mistake debt before more forward work."
        />
      )}

      {loading && (
        <Card title="Loading…" subtitle="Pulling your review queue">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Review could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={loadDuePreview}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && mode === "ready" && (
        <div className="grid gap-5">
          {engagementNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {engagementNotice}
            </div>
          )}

          <Card
            title="Recovery command"
            subtitle="Unfinished mistakes are active debt. Clear them before new volume."
            right={<Pill text={questions.length > 0 ? `${questions.length} due` : "Queue clear"} tone={queueTone} />}
            accent={questions.length > 0}
            prominence={questions.length > 0 ? "prominent" : "default"}
          >
            {questions.length === 0 ? (
              <>
                <div className="rounded-2xl border border-[#9de0bb] bg-[#ebfdf2] p-4 text-sm text-[#0f8a4e]">
                  Recovery queue is clear. Forward work is unlocked.
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton href="/practice?subject=Reading">Practice Reading</PrimaryButton>
                  <SecondaryButton href="/practice?subject=Math">Practice Math</SecondaryButton>
                </div>
              </>
            ) : (
              <>
                <section className="ink-surface overflow-hidden rounded-[28px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
                  <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div>
                      <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                        Debt to clear now
                      </div>
                      <div className="mt-2 text-4xl font-semibold tracking-tight text-white">{questions.length}</div>
                      <div className="mt-2 text-sm text-[#d2dbec]">
                      {questions.length >= 6 ? "High pressure queue." : "Manageable queue."} Finish this block before starting fresh practice.
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#7eb5ff,#b9d9ff)]"
                          style={{ width: `${Math.max(14, Math.min(100, (questions.length / limit) * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-[#cbd8f0]">
                        Session cap: <span className="font-semibold text-white">{limit}</span>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-[#cbd8f0]">
                        Queue state: <span className="font-semibold text-white">{queueLabel(questions.length)}</span>
                      </div>
                      {identity && identityStatus && (
                        <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-[#cbd8f0]">
                          {identityStatus.division.label} L{identityStatus.level} • {identity.streakDays}d streak
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                      Due topics now
                    </div>
                    <div className="mt-3 grid gap-2">
                      {queueTopicBuckets.slice(0, 4).map((bucket) => (
                        <div
                          key={`${bucket.subject}-${bucket.topic}`}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                        >
                          <span className="font-semibold text-black">{bucket.topic}</span>
                          <span className="mx-1 text-gray-300">•</span>
                          {bucket.subject}
                          <span className="mx-1 text-gray-300">•</span>
                          {bucket.count} due
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                      Queue subject split
                    </div>
                    <div className="mt-3 grid gap-2">
                      {queueSubjectBuckets.map((bucket) => (
                        <div
                          key={bucket.subject}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                        >
                          <span className="font-semibold text-black">{bucket.subject}</span>
                          <span className="mx-1 text-gray-300">•</span>
                          {bucket.count} item{bucket.count === 1 ? "" : "s"}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton onClick={startSession}>Start review</PrimaryButton>
                  <SecondaryButton href="/today">Back to Today</SecondaryButton>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {!loading && !err && mode === "in_session" && q && (
        <div className="grid gap-5">
          <div className="sticky top-[4.5rem] z-20 overflow-hidden rounded-2xl border border-[#22345e] bg-[linear-gradient(145deg,#0f172a,#111d35)] p-4 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">
                Recovery item {idx + 1} / {Math.max(total, 1)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill text={`Accuracy ${accuracyPct}%`} tone={accuracyPct >= 70 ? "success" : "accent"} />
                <Pill text={`Combo ${momentum.combo}`} tone={momentum.currentStreak >= 3 ? "success" : "neutral"} />
              </div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#7eb5ff,#b9d9ff)]" style={{ width: `${momentum.progressPct}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#c8d4ed] sm:grid-cols-4">
              <div>Cleared {analysis.reviewedCount}</div>
              <div>Correct {analysis.correctCount}</div>
              <div>Remaining {liveRemainingDebt}</div>
              <div className="sm:text-right">Recovery {recoveryRatePct}%</div>
            </div>
            <div className="mt-2 text-xs text-[#a2b5d8]">
              Queue pressure: {queueLabel(Math.max(queueStartCount ?? total, 0))}
            </div>
          </div>

          <Card
            title={`Recovery item ${idx + 1}`}
            subtitle={`Reason: ${currentReviewReason ? reviewReasonLabel(currentReviewReason) : "Review item"} • Accuracy so far: ${accuracyPct}%`}
            right={
              <Pill
                text={currentReviewReason ? reviewReasonLabel(currentReviewReason) : "Review mode"}
                tone={currentReviewReason ? reviewReasonTone(currentReviewReason) : "accent"}
              />
            }
            accent
            prominence="prominent"
          >
            <div className="text-lg font-medium leading-relaxed whitespace-pre-line text-[#0f172a]">
              {q.question_text}
            </div>

            <div className="mt-6 space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const chosen = selected === letter;
                const correct = locked && q.correct_option.toUpperCase() === letter;
                const wrongChosen = locked && chosen && !correct;

                let cls = "border border-gray-200 bg-white shadow-sm";
                if (chosen) cls = "border-[#0f1b33] bg-[#edf5ff] shadow-md";
                if (correct) cls = "border-[#2a9b67] bg-[#edfcf3] shadow-md";
                if (wrongChosen) cls = "border-[#d54768] bg-[#fff2f5] shadow-md";

                return (
                  <button
                    key={letter}
                    onClick={() => pick(letter)}
                    className={`w-full rounded-2xl p-4 text-left transition ${cls}`}
                    disabled={saving}
                  >
                    <div className="mb-1 text-xs font-semibold text-gray-500">{letter}</div>
                    <div className="text-sm text-gray-900">{optionText(letter)}</div>
                  </button>
                );
              })}
            </div>

            {err && (
              <div className="mt-5 rounded-xl border border-[#f5b8c4] bg-[#fff2f5] p-4 text-sm text-[#b02039]">
                {err}
                <div className="mt-3 grid gap-2">
                  <PrimaryButton onClick={retryRecord} disabled={saving}>
                    {saving ? "Retrying…" : "Retry record"}
                  </PrimaryButton>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3 items-start">
              {!locked ? (
                <button
                  className="w-full rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  {saving ? "Saving…" : "Submit recovery answer"}
                </button>
              ) : (
                <button
                  className="w-full rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                  onClick={nextOrFinish}
                  disabled={saving}
                >
                  {idx === total - 1 ? "Finish recovery block" : "Next recovery item"}
                </button>
              )}

              {locked && feedback && (
                <div className={`flex-1 rounded-2xl border p-5 ${feedback.correct ? "border-[#9de0bb] bg-[#ebfdf2]" : "border-[#f5b8c4] bg-[#fff2f5]"}`}>
                  <div className={`font-semibold ${feedback.correct ? "text-[#0f8a4e]" : "text-[#b02039]"}`}>
                    {feedback.correct ? "Recovered" : "Still unstable"}
                  </div>

                  <div className="mt-1 text-xs text-gray-600">
                    Reward: +{momentum.instantXp} XP • Combo {momentum.combo}
                  </div>

                  {!feedback.correct && (
                    <div className="mt-1 text-sm text-gray-700">
                      Correct answer: <span className="font-semibold">{feedback.correctOption}</span>
                    </div>
                  )}

                  {q.explanation ? (
                    <div className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                      <span className="font-semibold">Explanation:</span> {q.explanation}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-600">No explanation available yet.</div>
                  )}
                  <QuestionActionBlock
                    mode="review"
                    questionId={q.id}
                    subject={q.subject}
                    subskill={q.topic || undefined}
                    onExplain={generateAiExplanation}
                    aiExplainLoading={aiExplainLoading}
                    aiExplainError={aiExplainError}
                    aiExplain={aiExplain}
                    contextLine={`Review reason: ${currentReviewReason ?? "new mistake"}`}
                  />
                </div>
              )}
            </div>
          </Card>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-[rgba(248,251,255,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-3 shadow-xl backdrop-blur md:hidden">
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/90 bg-white/90 p-3">
              <div className="mb-2 text-xs font-semibold text-[#0f172a]">
                Recovery live • {analysis.reviewedCount}/{total} cleared
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={previousQuestion}
                  disabled={idx <= 0 || saving}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (!locked) {
                      void submit();
                      return;
                    }
                    void nextOrFinish();
                  }}
                  disabled={saving || (!locked && !selected)}
                  className="rounded-lg border border-[#0e1b34] bg-[#0e1b34] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {!locked ? "Submit" : idx === total - 1 ? "Finish" : "Next"}
                </button>
                <button
                  onClick={() => router.push("/today")}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !err && mode === "done" && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.08fr_0.92fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Recovery complete
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{outcomePill.text} state</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                  Debt reduced. Route the next move while these mistakes are still visible.
                </p>
                <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Reviewed: <span className="font-semibold text-white">{analysis.reviewedCount}</span>
                  </div>
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Accuracy: <span className="font-semibold text-white">{analysis.accuracyPct}%</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Recovered / unstable</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                    {analysis.correctCount} / {analysis.incorrectCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Next move</div>
                  <div className="mt-2 text-sm text-[#d2dbec]">{nextRecoveryRoute.note}</div>
                </div>
              </div>
            </div>
          </section>

          <Card
            title="Recovery session complete"
            subtitle="Debt reduced. Route the next move while the mistakes are still visible."
            right={<Pill text={outcomePill.text} tone={outcomePill.tone} />}
            accent
            prominence="prominent"
          >
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatBox label="Reviewed" value={`${analysis.reviewedCount}`} hint="Items completed" />
                  <StatBox label="Accuracy" value={`${analysis.accuracyPct}%`} hint="This review block" accent={analysis.accuracyPct >= 75} />
                  <StatBox label="Recovered" value={`${analysis.correctCount}`} hint="Correct recoveries" accent={analysis.correctCount > 0} />
                  <StatBox label="Still weak" value={`${analysis.incorrectCount}`} hint="Needs more repair" accent={analysis.incorrectCount > 0} />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Next move</div>
                <div className="mt-2 text-sm text-gray-700">{nextRecoveryRoute.note}</div>
                <div className="mt-4 grid gap-3">
                  <PrimaryButton href={nextRecoveryRoute.primaryHref}>{nextRecoveryRoute.primaryLabel}</PrimaryButton>
                  <SecondaryButton href={nextRecoveryRoute.secondaryHref}>{nextRecoveryRoute.secondaryLabel}</SecondaryButton>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Debt impact from this block
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Queue before: <span className="font-semibold text-black">{queueStartCount ?? "—"}</span>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Queue after: <span className="font-semibold text-black">{queueAfterCount ?? "—"}</span>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Debt cleared: <span className="font-semibold text-black">{debtDelta ?? "—"}</span>
                </div>
              </div>
              {postSessionNotice && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {postSessionNotice}
                </div>
              )}
            </div>
            {repairTopic && (
              <div className="mt-4 rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                  Primary repair target
                </div>
                <div className="mt-2 text-lg font-semibold text-black">{repairTopic}</div>
                <div className="mt-2 text-sm text-gray-700">
                  Subject: {repairSubject}
                  {analysis.primaryRepairTarget && (
                    <>
                      {" "}• Accuracy in this session: {Math.round(analysis.primaryRepairTarget.accuracy * 100)}%
                      {" "}({analysis.primaryRepairTarget.correct}/{analysis.primaryRepairTarget.total})
                    </>
                  )}
                </div>
              </div>
            )}
            {failedTopicRoutes.length > 0 && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Repair routes from this block
                </div>
                <div className="mt-3 grid gap-3">
                  {failedTopicRoutes.map((topic) => (
                    <div key={`${topic.subject}-${topic.topic}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-semibold text-black">{topic.topic}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {topic.subject} • {Math.round(topic.accuracy * 100)}% ({topic.correct}/{topic.total})
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <SecondaryButton href={topic.practiceHref}>Practice this topic</SecondaryButton>
                        <SecondaryButton href={topic.lessonHref}>Open lesson</SecondaryButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {analysis.recoveredTopics.length > 0 && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Recovered cleanly
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.recoveredTopics.slice(0, 6).map((topic) => (
                    <Pill
                      key={topic.topic}
                      text={`${topic.topic} • ${Math.round(topic.accuracy * 100)}%`}
                      tone="success"
                    />
                  ))}
                </div>
              </div>
            )}
            {analysis.failedTopics.length > 1 && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Other weak topics from this session
                </div>
                <div className="mt-3 grid gap-2">
                  {analysis.failedTopics.slice(1, 4).map((topic) => (
                    <div key={topic.topic} className="text-sm text-gray-700">
                      <span className="font-semibold">{topic.topic}</span> — {Math.round(topic.accuracy * 100)}% ({topic.correct}/{topic.total})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sessionPayoff && identityStatus && identity && (
              <SessionPayoffCard
                payoff={sessionPayoff}
                status={identityStatus}
                streakDays={identity.streakDays}
                mode="review"
              />
            )}

            {identityStatus && identity && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Retention status
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  Division: <span className="font-semibold text-black">{identityStatus.division.label}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  Level {identityStatus.level}
                  <span className="mx-2 text-gray-300">•</span>
                  Streak {identity.streakDays}d
                </div>
                {identityStatus.nextDivision && (
                  <div className="mt-2 text-sm text-gray-700">
                    {pointsToNextDivision(identity)} XP to {identityStatus.nextDivision.label}
                  </div>
                )}
              </div>
            )}

            {shareText && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Shareable result
                </div>
                <div className="mt-2 text-sm leading-relaxed text-gray-700">{shareText}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                  <PrimaryButton onClick={copyShareResult}>
                    {copiedShare ? "Copied" : "Copy result"}
                  </PrimaryButton>
                  <SecondaryButton href="/leagues">Post in community</SecondaryButton>
                </div>
              </div>
            )}

            {engagementNotice && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                {engagementNotice}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {historySessionId ? (
                <PrimaryButton href={`/history?session=${encodeURIComponent(historySessionId)}`}>Reopen this result</PrimaryButton>
              ) : (
                <SecondaryButton href="/history">Open history</SecondaryButton>
              )}
              <PrimaryButton onClick={loadDuePreview}>Check due again</PrimaryButton>
              <SecondaryButton onClick={startSession}>Replay this recovery block</SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
              <SecondaryButton href="/coach">Open coach</SecondaryButton>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
