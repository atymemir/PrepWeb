'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { useStudentState } from "../lib/useStudentState";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";
import QuestionActionBlock from "../components/QuestionActionBlock";
import StudyFeedbackFX from "../components/StudyFeedbackFX";

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

type QueueDueReason = "single-unresolved" | "cluster-relapse" | "high-pressure" | "unknown-skill";

function queueDueReasonFor(args: {
  question: Question;
  topicLoad: number;
}): QueueDueReason {
  const topic = topicKey(args.question.topic);
  if (topic === "Unknown") return "unknown-skill";
  if (args.topicLoad >= 4) return "high-pressure";
  if (args.topicLoad >= 2) return "cluster-relapse";
  return "single-unresolved";
}

function queueDueReasonLabel(reason: QueueDueReason): string {
  if (reason === "high-pressure") return "High-pressure topic";
  if (reason === "cluster-relapse") return "Topic relapse cluster";
  if (reason === "unknown-skill") return "Unknown-skill debt";
  return "Single unresolved miss";
}

function queueDueReasonNote(reason: QueueDueReason): string {
  if (reason === "high-pressure") return "Multiple due items in this topic are still unresolved.";
  if (reason === "cluster-relapse") return "This topic has repeated due items and needs clean recovery.";
  if (reason === "unknown-skill") return "Topic labeling is weak here, so treat this as active debt.";
  return "A prior miss is still open and returned for recovery.";
}

function queueDueReasonTone(reason: QueueDueReason): "neutral" | "accent" | "danger" {
  if (reason === "high-pressure") return "danger";
  if (reason === "cluster-relapse" || reason === "unknown-skill") return "accent";
  return "neutral";
}

export default function ReviewPage() {
  const router = useRouter();
  const { state: studentState, refresh: refreshStudentState } = useStudentState({
    dueLimit: 120,
    historyLimit: 64,
  });
  const limit = 12;
  const queuePreviewLimit = 120;

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"ready" | "in_session" | "done">("ready");
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [fullDueQuestions, setFullDueQuestions] = useState<Question[]>([]);
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
  const queueTotalCount = queueStartCount ?? fullDueQuestions.length;
  const currentBlockCount = questions.length;
  const deferredQueueCount = Math.max(queueTotalCount - currentBlockCount, 0);
  const queueCountLabel = queueTotalCount >= queuePreviewLimit ? `${queuePreviewLimit}+` : `${queueTotalCount}`;
  const blockCountLabel = `${currentBlockCount}/${queueCountLabel}`;

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
    const pressure = queueTotalCount;
    if (pressure === 0) return "success" as const;
    if (pressure <= 4) return "accent" as const;
    if (pressure <= 8) return "accent" as const;
    return "danger" as const;
  }, [queueTotalCount]);

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

  const queueSource = useMemo(
    () => (fullDueQuestions.length ? fullDueQuestions : questions),
    [fullDueQuestions, questions]
  );

  const queueTopicLoad = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of queueSource) {
      const topic = topicKey(question.topic);
      map.set(topic, (map.get(topic) ?? 0) + 1);
    }
    return map;
  }, [queueSource]);

  const queueTopicBuckets = useMemo(() => {
    const buckets = new Map<string, { topic: string; subject: string; count: number }>();
    for (const question of queueSource) {
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
  }, [queueSource]);

  const queueDueReasonBuckets = useMemo(() => {
    const buckets = new Map<QueueDueReason, number>();
    for (const question of queueSource) {
      const topic = topicKey(question.topic);
      const reason = queueDueReasonFor({
        question,
        topicLoad: queueTopicLoad.get(topic) ?? 0,
      });
      buckets.set(reason, (buckets.get(reason) ?? 0) + 1);
    }

    return [...buckets.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [queueSource, queueTopicLoad]);

  const currentQueueDueReason = useMemo(() => {
    if (!q) return null;
    const topic = topicKey(q.topic);
    return queueDueReasonFor({
      question: q,
      topicLoad: queueTopicLoad.get(topic) ?? 0,
    });
  }, [q, queueTopicLoad]);

  const queueMeterPct = useMemo(() => {
    if (queueTotalCount === 0) return 100;
    return Math.max(12, Math.min(100, Math.round((currentBlockCount / queueTotalCount) * 100)));
  }, [currentBlockCount, queueTotalCount]);

  const liveRemainingDebt = useMemo(
    () => Math.max(total - analysis.reviewedCount, 0),
    [total, analysis.reviewedCount]
  );

  const liveRecoveryPct = useMemo(() => {
    if (!total) return 0;
    return Math.round((analysis.reviewedCount / total) * 100);
  }, [analysis.reviewedCount, total]);

  const recoveryRatePct = useMemo(() => {
    if (analysis.reviewedCount === 0) return 0;
    return Math.round((analysis.correctCount / analysis.reviewedCount) * 100);
  }, [analysis.correctCount, analysis.reviewedCount]);

  const currentDueReasonLine = useMemo(() => {
    if (!currentQueueDueReason) return "Returned from unresolved prior debt.";
    if (!locked || !feedback) return queueDueReasonNote(currentQueueDueReason);
    if (feedback.correct) return "Recovered on this attempt. Queue retirement depends on scheduler confirmation.";
    return "Failed recovery on this attempt. This item stays active debt.";
  }, [currentQueueDueReason, feedback, locked]);

  const debtDelta = useMemo(() => {
    if (queueStartCount === null || queueAfterCount === null) return null;
    return queueStartCount - queueAfterCount;
  }, [queueAfterCount, queueStartCount]);

  const debtDeltaLabel = useMemo(() => {
    if (debtDelta === null) return "Pending";
    if (debtDelta > 0) return `${debtDelta} cleared`;
    if (debtDelta === 0) return "No net change";
    return `${Math.abs(debtDelta)} added`;
  }, [debtDelta]);

  const recoveryVerdict = useMemo(() => {
    if (analysis.outcome === "rebuild") {
      return {
        title: "Rebuild the pattern",
        note: "Accuracy is too unstable for forward volume. Lesson first, then a targeted set.",
        tone: "danger" as const,
      };
    }
    if (analysis.outcome === "stabilize") {
      return {
        title: "Stabilize the miss",
        note: "You recovered part of the queue. Run a focused set before broad practice.",
        tone: "accent" as const,
      };
    }
    return {
      title: "Debt under control",
      note: "The block was clean enough to advance. Keep review active after new misses.",
      tone: "success" as const,
    };
  }, [analysis.outcome]);

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

  const exactNextStep = useMemo(() => {
    if ((queueAfterCount ?? 0) > 0) {
      return `Next step now: continue the recovery queue (${queueAfterCount} due remain).`;
    }
    if (analysis.outcome === "rebuild") {
      return repairTopic
        ? `Next step now: open ${repairTopic} lesson, then run targeted practice.`
        : "Next step now: open a repair lesson, then run targeted practice.";
    }
    if (analysis.outcome === "stabilize") {
      return repairTopic
        ? `Next step now: run targeted practice on ${repairTopic}.`
        : "Next step now: run one targeted practice set before broad volume.";
    }
    return "Next step now: return to forward practice, then re-check review after new misses.";
  }, [analysis.outcome, queueAfterCount, repairTopic]);

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
    setFullDueQuestions([]);
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
      const { data, error } = await supabase.rpc("get_due_review_questions", { p_limit: queuePreviewLimit });
      if (error) throw new Error(error.message);

      const fullList = (data ?? []) as Question[];
      const blockList = fullList.slice(0, limit);
      setFullDueQuestions(fullList);
      setQuestions(blockList);
      setQueueStartCount(fullList.length);
      setMomentum(createMomentum(blockList.length || limit));
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
    setQueueStartCount(queueTotalCount);
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
        const dueRes = await supabase.rpc("get_due_review_questions", { p_limit: queuePreviewLimit });
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
    void refreshStudentState();
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
      <StudyFeedbackFX
        active={mode === "done"}
        variant={analysis.outcome === "advance" ? "complete" : "recovery"}
        intensity={analysis.outcome === "advance" ? "standard" : "subtle"}
      />
      <StudyFeedbackFX
        active={mode === "in_session" && !!feedback?.correct}
        variant="correct"
        intensity="subtle"
      />
      <PageHeader
        label="Recovery workflow"
        title="Review"
        subtitle="Clear one focused recovery block, then decide whether to continue debt or route to repair."
        right={
          <button
            onClick={() => router.push("/today")}
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
          >
            Back
          </button>
        }
      />

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

          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            {questions.length === 0 ? (
              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="inline-flex items-center rounded-full border border-[#4f9a72] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bff2d2]">
                    Queue clear
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    No unfinished debt
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d3efdf]">
                    Recovery is clear. Move into forward practice and let new misses refill queue only when needed.
                  </p>
                  <div className="mt-6 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                    <PrimaryButton href="/practice?subject=Reading">Practice Reading</PrimaryButton>
                    <SecondaryButton href="/practice?subject=Math">Practice Math</SecondaryButton>
                  </div>
                  {studentState && (
                    <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-xs text-[#d3efdf]">
                      Shared command: {studentState.recommendedAction.title}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-[#d3efdf]">
                  <div className="font-semibold text-white">Debt now: 0</div>
                  <div className="mt-2 text-xs">Queue state: Clear</div>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Queue and debt
                </div>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  {queueCountLabel} due
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
                  Current block: {currentBlockCount}. Deferred after launch: {deferredQueueCount}.
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#ff89a3,#8fc1ff)]"
                    style={{ width: `${queueMeterPct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#c8d4ed]">
                  <Pill text={`Block ${blockCountLabel}`} tone={queueTone} />
                  <span>{queueLabel(queueTotalCount)}</span>
                  {queueDueReasonBuckets[0] && (
                    <Pill text={queueDueReasonLabel(queueDueReasonBuckets[0].reason)} tone={queueDueReasonTone(queueDueReasonBuckets[0].reason)} />
                  )}
                  {identity && identityStatus && (
                    <span>{identityStatus.division.label} L{identityStatus.level} • {identity.streakDays}d streak</span>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                  <button
                    onClick={startSession}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#ecf3ff]"
                  >
                    Start recovery block
                  </button>
                  <SecondaryButton href="/today">Back to Today</SecondaryButton>
                </div>

                {studentState && (
                  <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bdd5ff]">
                      Unified student state
                    </div>
                    <div className="mt-2 text-xs text-[#d8e5fc]">
                      {studentState.recommendedAction.reason}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Link
                        href={studentState.recommendedAction.primaryHref}
                        className="inline-flex items-center justify-center rounded-lg border border-[#5872a7] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb] transition hover:bg-white/15"
                      >
                        {studentState.recommendedAction.primaryLabel}
                      </Link>
                      <Link
                        href={studentState.recommendedAction.secondaryHref}
                        className="inline-flex items-center justify-center rounded-lg border border-[#5872a7] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb] transition hover:bg-white/15"
                      >
                        {studentState.recommendedAction.secondaryLabel}
                      </Link>
                    </div>
                  </div>
                )}

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#bdd5ff]">
                      Debt topics
                    </div>
                    <div className="mt-3 grid gap-2">
                      {queueTopicBuckets.slice(0, 4).map((bucket) => (
                        <div key={`${bucket.subject}-${bucket.topic}`} className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-[#e2ebff]">
                          <span>{bucket.topic}</span>
                          <span className="font-semibold">{bucket.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#bdd5ff]">
                      Due reason split
                    </div>
                    <div className="mt-3 grid gap-2">
                      {queueDueReasonBuckets.map((bucket) => (
                        <div key={bucket.reason} className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-[#e2ebff]">
                          <span>{queueDueReasonLabel(bucket.reason)}</span>
                          <Pill text={`${bucket.count}`} tone={queueDueReasonTone(bucket.reason)} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-[#c8d4ed]">
                      Full debt {queueCountLabel} • Block {currentBlockCount} • Deferred {deferredQueueCount}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
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
                {currentQueueDueReason && (
                  <Pill text={queueDueReasonLabel(currentQueueDueReason)} tone={queueDueReasonTone(currentQueueDueReason)} />
                )}
              </div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#7eb5ff,#b9d9ff)]" style={{ width: `${momentum.progressPct}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#c8d4ed]">
              <div>Cleared {analysis.reviewedCount}</div>
              <div>Remaining {liveRemainingDebt}</div>
              <div>Recovery {recoveryRatePct}%</div>
            </div>
            <div className="mt-2 text-xs text-[#a2b5d8]">
              Block {total} of {queueCountLabel} due items. {deferredQueueCount > 0 ? `${deferredQueueCount} stay queued after this block.` : "No deferred debt detected."}
            </div>
          </div>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-3xl border border-[#b9d6ff] bg-white/95 p-5 shadow-lg sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                    Recovery item {idx + 1}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {q.topic || "Unknown"} • {q.subject}
                  </div>
                </div>
                <Pill
                  text={currentReviewReason ? reviewReasonLabel(currentReviewReason) : "Review mode"}
                  tone={currentReviewReason ? reviewReasonTone(currentReviewReason) : "accent"}
                />
              </div>

              <div className="text-lg font-medium leading-relaxed whitespace-pre-line text-[#0f172a]">
                {q.question_text}
              </div>

              <div className="mt-6 grid gap-3">
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
                      className={`grid w-full grid-cols-[2.25rem_1fr] items-start gap-3 rounded-2xl p-4 text-left transition ${cls}`}
                      disabled={saving}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-600">
                        {letter}
                      </div>
                      <div className="pt-1 text-sm leading-relaxed text-gray-900">{optionText(letter)}</div>
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

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {!locked ? (
                  <button
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                    onClick={submit}
                    disabled={!selected || saving}
                  >
                    {saving ? "Saving..." : "Submit recovery answer"}
                  </button>
                ) : (
                  <button
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                    onClick={nextOrFinish}
                    disabled={saving}
                  >
                    {idx === total - 1 ? "Finish recovery block" : "Next recovery item"}
                  </button>
                )}
                <button
                  onClick={previousQuestion}
                  disabled={idx <= 0 || saving}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                >
                  Previous
                </button>
              </div>
            </div>

            <aside className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                Live recovery shell
              </div>
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Due reason</div>
                  {currentQueueDueReason && (
                    <Pill text={queueDueReasonLabel(currentQueueDueReason)} tone={queueDueReasonTone(currentQueueDueReason)} />
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-700">{currentDueReasonLine}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-gray-700">
                    Left <span className="font-semibold text-black">{liveRemainingDebt}</span>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-gray-700">
                    Recovered <span className="font-semibold text-black">{analysis.correctCount}</span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#0e1b34]"
                    style={{ width: `${liveRecoveryPct}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {analysis.reviewedCount}/{total} processed • {analysis.incorrectCount} unstable
                </div>
              </div>

              <div className="mt-3">
                {locked && feedback ? (
                  <div className={`rounded-2xl border p-4 ${feedback.correct ? "border-[#9de0bb] bg-[#ebfdf2]" : "border-[#f5b8c4] bg-[#fff2f5]"}`}>
                    <div className={`text-base font-semibold ${feedback.correct ? "text-[#0f8a4e]" : "text-[#b02039]"}`}>
                      {feedback.correct ? "Recovered" : "Still unstable"}
                    </div>
                    <div className="mt-1 text-xs text-gray-700">+{momentum.instantXp} XP • Combo {momentum.combo}</div>
                    {!feedback.correct && (
                      <div className="mt-2 text-sm text-gray-700">
                        Correct answer: <span className="font-semibold">{feedback.correctOption}</span>
                      </div>
                    )}
                    {q.explanation ? (
                      <div className="mt-3 text-sm leading-relaxed whitespace-pre-line text-gray-700">
                        {q.explanation}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-gray-600">No explanation available yet.</div>
                    )}
                    <div className="mt-4">
                      <QuestionActionBlock
                        mode="review"
                        questionId={q.id}
                        subject={q.subject}
                        subskill={q.topic || undefined}
                        onExplain={generateAiExplanation}
                        aiExplainLoading={aiExplainLoading}
                        aiExplainError={aiExplainError}
                        aiExplain={aiExplain}
                        contextLine={`Due: ${currentQueueDueReason ? queueDueReasonLabel(currentQueueDueReason) : "Unresolved debt"} • Review reason: ${currentReviewReason ?? "new mistake"}`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#d7e5fb] bg-[#f6faff] p-4 text-sm leading-relaxed text-gray-700">
                    Pick the answer you can defend. This shell is a recovery check, not a speed drill.
                  </div>
                )}
              </div>
            </aside>
          </section>

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
        <div className="grid gap-5">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Recovery complete
                </div>
                <Pill text={outcomePill.text} tone={outcomePill.tone} />
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {recoveryVerdict.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
                {recoveryVerdict.note}
              </p>
              <div className="mt-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-[#dce6f9]">
                {exactNextStep}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-[#d8e5fc]">
                  Debt before <span className="font-semibold text-white">{queueStartCount ?? "-"}</span>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-[#d8e5fc]">
                  Debt after <span className="font-semibold text-white">{queueAfterCount ?? "-"}</span>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-[#d8e5fc]">
                  Net <span className="font-semibold text-white">{debtDeltaLabel}</span>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-[#d8e5fc]">
                  Accuracy <span className="font-semibold text-white">{analysis.accuracyPct}%</span>
                </div>
              </div>

              {studentState && (
                <div className="mt-3 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-[#dce6f9]">
                  Unified next command: <span className="font-semibold text-white">{studentState.recommendedAction.title}</span>
                  <div className="mt-1 text-xs text-[#c8d4ed]">{studentState.recommendedAction.payoff}</div>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                <PrimaryButton href={nextRecoveryRoute.primaryHref}>{nextRecoveryRoute.primaryLabel}</PrimaryButton>
                <SecondaryButton href={nextRecoveryRoute.secondaryHref}>{nextRecoveryRoute.secondaryLabel}</SecondaryButton>
              </div>

              <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-[#d8e5fc]">
                Reviewed <span className="font-semibold text-white">{analysis.reviewedCount}/{currentBlockCount}</span>
                <span className="mx-2 text-[#89a4d1]">•</span>
                Recovered <span className="font-semibold text-white">{analysis.correctCount}</span>
                <span className="mx-2 text-[#89a4d1]">•</span>
                Unstable <span className="font-semibold text-white">{analysis.incorrectCount}</span>
              </div>

              {repairTopic && (
                <div className="mt-4 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-[#dce6f9]">
                  Repair target:{" "}
                  <span className="font-semibold text-white">
                    {repairTopic} ({repairSubject}
                    {analysis.primaryRepairTarget && (
                      <> • {Math.round(analysis.primaryRepairTarget.accuracy * 100)}% ({analysis.primaryRepairTarget.correct}/{analysis.primaryRepairTarget.total})</>
                    )}
                    )
                  </span>
                  <div className="mt-1 text-xs text-[#c8d4ed]">
                    Secondary action is already routed into focused repair.
                  </div>
                </div>
              )}

              {failedTopicRoutes.length > 0 && (
                <div className="mt-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-[#d8e5fc]">
                  Additional weak spots:{" "}
                  <span className="font-semibold text-white">
                    {failedTopicRoutes.map((topic) => `${topic.topic} (${Math.round(topic.accuracy * 100)}%)`).join(" • ")}
                  </span>
                </div>
              )}

              {postSessionNotice && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {postSessionNotice}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {historySessionId ? (
                  <SecondaryButton href={`/history?session=${encodeURIComponent(historySessionId)}`}>View in history</SecondaryButton>
                ) : (
                  <SecondaryButton href="/history">View history</SecondaryButton>
                )}
                <SecondaryButton href="/today">Back to Today</SecondaryButton>
                {shareText && (
                  <button
                    onClick={copyShareResult}
                    className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 font-semibold text-[#dce6f9] transition hover:bg-white/20"
                  >
                    {copiedShare ? "Copied result" : "Copy result"}
                  </button>
                )}
                {sessionPayoff && identityStatus && identity && (
                  <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 font-medium text-[#dce6f9]">
                    {identityStatus.division.label} L{identityStatus.level} • {identity.streakDays}d • +{sessionPayoff.totalAwarded} XP
                  </span>
                )}
              </div>

              {engagementNotice && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  {engagementNotice}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
