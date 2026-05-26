'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { analyzeReviewSession } from "../lib/sessionAnalysis";
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
  type SessionPayoff,
  type SessionMomentum,
} from "../lib/engagement";
import {
  getDurableEngagementSnapshot,
  recordDurableEngagementSession,
} from "../lib/engagementDurable";
import { recordStudySession } from "../lib/sessionHistory";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import QuestionActionBlock from "../components/QuestionActionBlock";
import { SessionPayoffCard } from "../components/EngagementSystem";
import MathToolsLayer from "../components/MathToolsLayer";

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

type AnswerInsert = {
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  is_review: boolean;
  time_taken_seconds: number;
  subject: string;
  topic: string | null;
};

type Mode = "setup" | "in_session" | "done";
type PracticeMode = "trainer" | "timed" | "exam";

type ScoreBand = {
  low: number;
  high: number;
  center: number;
  confidence: "Low" | "Medium" | "High";
  signalAnswers: number;
};

const PRACTICE_MODES: Array<{ key: PracticeMode; label: string; note: string }> = [
  {
    key: "trainer",
    label: "Trainer",
    note: "Instant feedback. Best for repair and pattern learning.",
  },
  {
    key: "timed",
    label: "Timed",
    note: "Per-question timer pressure, with immediate feedback.",
  },
  {
    key: "exam",
    label: "Exam",
    note: "Strict block simulation. No feedback until the end.",
  },
];

function createClientSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePracticeMode(raw: string | null): PracticeMode {
  if (raw === "timed") return "timed";
  if (raw === "exam") return "exam";
  return "trainer";
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function questionTimeLimitSeconds(subject: "Reading" | "Math" | "Combined"): number {
  if (subject === "Reading") return 70;
  if (subject === "Math") return 95;
  return 82;
}

function examTimeLimitSeconds(questions: Array<{ subject: string }>): number {
  if (!questions.length) return 0;
  return questions.reduce((total, question) => {
    const qSubject = question.subject === "Math" ? "Math" : question.subject === "Reading" ? "Reading" : "Combined";
    return total + questionTimeLimitSeconds(qSubject);
  }, 0);
}

function autoOptionForQuestion(questionId: string): "A" | "B" | "C" | "D" {
  let hash = 0;
  for (let i = 0; i < questionId.length; i += 1) {
    hash = (hash * 31 + questionId.charCodeAt(i)) >>> 0;
  }
  return (["A", "B", "C", "D"] as const)[hash % 4];
}

function elapsedSecondsFrom(startedAtMs: number): number {
  return Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
}

function roundToTen(n: number): number {
  return Math.round(n / 10) * 10;
}

function estimateScoreBand(args: {
  lifetimeAnswers: number;
  lifetimeCorrect: number;
  sessionAnswers: number;
  sessionCorrect: number;
}): ScoreBand {
  const lifetimeAnswers = Math.max(0, Math.round(args.lifetimeAnswers));
  const lifetimeCorrect = Math.max(0, Math.round(args.lifetimeCorrect));
  const sessionAnswers = Math.max(0, Math.round(args.sessionAnswers));
  const sessionCorrect = Math.max(0, Math.round(args.sessionCorrect));

  const lifetimeAcc = lifetimeAnswers > 0 ? lifetimeCorrect / lifetimeAnswers : 0.56;
  const sessionAcc = sessionAnswers > 0 ? sessionCorrect / sessionAnswers : lifetimeAcc;
  const sessionWeight = Math.min(0.55, sessionAnswers / 24);
  const blendedAcc = lifetimeAcc * (1 - sessionWeight) + sessionAcc * sessionWeight;

  const centerRaw = 800 + blendedAcc * 800;
  const center = Math.max(800, Math.min(1600, roundToTen(centerRaw)));

  const signalAnswers = lifetimeAnswers + sessionAnswers;
  let halfBand = signalAnswers < 24 ? 140 : signalAnswers < 60 ? 110 : signalAnswers < 120 ? 85 : 70;
  if (sessionAnswers < 8) halfBand += 20;

  const low = Math.max(800, roundToTen(center - halfBand));
  const high = Math.min(1600, roundToTen(center + halfBand));

  const confidence: "Low" | "Medium" | "High" =
    signalAnswers < 24 ? "Low" : signalAnswers < 90 ? "Medium" : "High";

  return { low, high, center, confidence, signalAnswers };
}

export default function PracticeClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const subject = (sp.get("subject") || "Reading") as "Reading" | "Math" | "Combined";
  const subskill = sp.get("subskill") || "";
  const limit = 12;

  const [mode, setMode] = useState<Mode>("setup");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(() =>
    normalizePracticeMode(sp.get("mode"))
  );

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctOption: string } | null>(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);
  const [aiExplain, setAiExplain] = useState<AiExplanation | null>(null);

  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, AnswerInsert>>({});
  const [saving, setSaving] = useState(false);
  const [identity, setIdentity] = useState<EngagementIdentity | null>(null);
  const [identityStatus, setIdentityStatus] = useState<EngagementStatus | null>(null);
  const [momentum, setMomentum] = useState<SessionMomentum>(() => createMomentum(limit));
  const [sessionPayoff, setSessionPayoff] = useState<SessionPayoff | null>(null);
  const [shareText, setShareText] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [sessionClientId, setSessionClientId] = useState<string>(() => createClientSessionId());
  const [engagementNotice, setEngagementNotice] = useState<string | null>(null);
  const [timingNotice, setTimingNotice] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const [questionSecondsLeft, setQuestionSecondsLeft] = useState<number | null>(null);
  const [examSecondsLeft, setExamSecondsLeft] = useState<number | null>(null);
  const [examDraftAnswers, setExamDraftAnswers] = useState<Record<string, string>>({});
  const [examMarked, setExamMarked] = useState<Record<string, boolean>>({});
  const [examStartedAtMs, setExamStartedAtMs] = useState<number>(() => Date.now());
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);

  const q = questions[idx];
  const total = questions.length;

  const sessionAnalysis = useMemo(() => {
    return analyzeReviewSession(
      Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        subject: value.subject,
        topic: value.topic,
        correct: value.is_correct,
      }))
    );
  }, [answers]);

  const answeredCount = sessionAnalysis.reviewedCount;
  const correctCount = sessionAnalysis.correctCount;
  const accuracyPct = sessionAnalysis.accuracyPct;

  const examAnsweredCount = useMemo(() => Object.keys(examDraftAnswers).length, [examDraftAnswers]);
  const examMarkedCount = useMemo(
    () => Object.values(examMarked).filter(Boolean).length,
    [examMarked]
  );

  const scoreBand = useMemo(() => {
    return estimateScoreBand({
      lifetimeAnswers: identity?.totalAnswers ?? 0,
      lifetimeCorrect: identity?.totalCorrect ?? 0,
      sessionAnswers: answeredCount,
      sessionCorrect: correctCount,
    });
  }, [identity, answeredCount, correctCount]);

  const repairTopic = sessionAnalysis.primaryRepairTarget?.topic ?? null;
  const repairSubject = useMemo(() => {
    if (!repairTopic) return subject === "Combined" ? "Reading" : subject;
    const found = Object.values(answers).find(
      (answer) => (answer.topic?.trim() || "Unknown") === repairTopic
    );
    return (found?.subject as "Reading" | "Math") || (subject === "Combined" ? "Reading" : subject);
  }, [answers, repairTopic, subject]);

  const repairPracticeHref = repairTopic
    ? `/practice?subject=${repairSubject}&subskill=${encodeURIComponent(repairTopic)}`
    : `/practice?subject=${subject}`;
  const repairLessonHref = repairTopic ? `/lesson/${encodeURIComponent(repairTopic)}` : "/lessons";
  const hasMathTools = subject === "Math" || subject === "Combined" || q?.subject === "Math";
  const toolsTopicHint = q?.topic || subskill || (subject === "Combined" ? q?.subject || "Math" : subject);

  const sessionOutcome = useMemo(() => {
    if (mode !== "done" || total === 0) return null;

    if (sessionAnalysis.outcome === "rebuild") {
      return {
        title: "Weak signal",
        tone: "danger" as const,
        note: repairTopic
          ? `Do not move on blindly. Repair ${repairTopic}, then test it with a targeted set.`
          : "Do not move on blindly. Open the skills map and repair the weak area first.",
      };
    }

    if (sessionAnalysis.outcome === "stabilize") {
      return {
        title: "Partial control",
        tone: "accent" as const,
        note: repairTopic
          ? `You are close, but ${repairTopic} still needs focused reinforcement.`
          : "You are close, but not stable yet. One more focused set is the right next move.",
      };
    }

    return {
      title: "Good enough to advance",
      tone: "success" as const,
      note: "This set was clean enough. Move forward, but let review catch any mistakes that still need recovery.",
    };
  }, [mode, total, sessionAnalysis.outcome, repairTopic]);

  function optionText(letter: string) {
    if (!q) return "";
    switch (letter) {
      case "A":
        return q.option_a;
      case "B":
        return q.option_b;
      case "C":
        return q.option_c;
      case "D":
        return q.option_d;
      default:
        return "";
    }
  }

  function resetQuestionUI() {
    if (practiceMode === "exam" && q) {
      setSelected(examDraftAnswers[q.id] ?? null);
    } else {
      setSelected(null);
    }
    setLocked(false);
    setFeedback(null);
    setAiExplain(null);
    setAiExplainError(null);
    setAiExplainLoading(false);
    setStartedAt(Date.now());
  }

  function resetTimingState() {
    setTimingNotice(null);
    if (practiceMode === "timed") {
      setQuestionSecondsLeft(questionTimeLimitSeconds((questions[0]?.subject as "Reading" | "Math" | "Combined") || subject));
      setExamSecondsLeft(null);
      return;
    }

    if (practiceMode === "exam") {
      setQuestionSecondsLeft(null);
      setExamSecondsLeft(examTimeLimitSeconds(questions));
      return;
    }

    setQuestionSecondsLeft(null);
    setExamSecondsLeft(null);
  }

  function pick(letter: string) {
    if (locked || saving) return;
    setSelected(letter);
  }

  function toggleExamMarkCurrent() {
    if (!q) return;
    setExamMarked((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
  }

  async function ensureAuthAndLoad() {
    setLoading(true);
    setErr(null);

    try {
      const supabase = getSupabase();

      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);

      const session = sessionData.session;
      if (!session) {
        router.push("/login");
        return;
      }

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

      const { data, error } = await supabase.rpc("get_practice_questions", {
        p_subject: subject === "Combined" ? "Reading" : subject,
        p_subskill: subject === "Combined" ? null : subskill,
        p_limit: subject === "Combined" ? Math.ceil(limit / 2) : limit,
      });

      if (error) throw new Error(error.message);

      let list = (data ?? []) as Question[];

      if (subject === "Combined") {
        const { data: mathData, error: mathError } = await supabase.rpc("get_practice_questions", {
          p_subject: "Math",
          p_subskill: null,
          p_limit: Math.floor(limit / 2),
        });

        if (mathError) throw new Error(mathError.message);

        const reading = list;
        const math = (mathData ?? []) as Question[];
        const mixed: Question[] = [];
        const maxLen = Math.max(reading.length, math.length);

        for (let i = 0; i < maxLen; i += 1) {
          if (reading[i]) mixed.push(reading[i]);
          if (math[i]) mixed.push(math[i]);
        }

        list = mixed.slice(0, limit);
      }
      if (!list.length) throw new Error("No questions returned for this filter.");

      setQuestions(list);
      setIdx(0);
      setAnswers({});
      setMomentum(createMomentum(list.length || limit));
      setSessionPayoff(null);
      setShareText("");
      setCopiedShare(false);
      setSessionClientId(createClientSessionId());
      setHistorySessionId(null);
      setToolsOpen(false);
      setExamDraftAnswers({});
      setExamMarked({});
      setExamStartedAtMs(Date.now());
      resetQuestionUI();
      resetTimingState();
      setMode("setup");
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load practice."));
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (!cancelled) await ensureAuthAndLoad();
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, subskill]);

  function switchSubject(nextSubject: "Reading" | "Math" | "Combined") {
    const params = new URLSearchParams(sp.toString());
    params.set("subject", nextSubject);
    params.delete("subskill");
    router.push(`/practice?${params.toString()}`);
  }

  function startSession() {
    setMode("in_session");
    setIdx(0);
    setAnswers({});
    setMomentum(createMomentum(questions.length || limit));
    setSessionPayoff(null);
    setShareText("");
    setCopiedShare(false);
    setSessionClientId(createClientSessionId());
    setHistorySessionId(null);
    setToolsOpen(false);
    setExamDraftAnswers({});
    setExamMarked({});
    setExamStartedAtMs(Date.now());
    resetQuestionUI();
    resetTimingState();
  }

  function buildTopicSnapshots(source: Record<string, AnswerInsert>) {
    const buckets = new Map<string, { subject: string | null; correct: number; total: number }>();
    for (const answer of Object.values(source)) {
      const key = (answer.topic?.trim() || "Unknown");
      if (!buckets.has(key)) {
        buckets.set(key, { subject: answer.subject || null, correct: 0, total: 0 });
      }
      const bucket = buckets.get(key)!;
      bucket.total += 1;
      if (answer.is_correct) bucket.correct += 1;
    }
    return [...buckets.entries()].map(([topic, value]) => ({
      topic,
      subject: value.subject,
      correctCount: value.correct,
      totalCount: value.total,
    }));
  }

  const finishSession = useCallback(async (finalAnswers?: Record<string, AnswerInsert>) => {
    const source = finalAnswers ?? answers;
    const answered = Object.keys(source).length;
    const correct = Object.values(source).filter((answer) => answer.is_correct).length;

    try {
      const applied = await recordDurableEngagementSession({
        clientSessionId: sessionClientId,
        mode: "practice",
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
          mode: practiceMode === "exam" ? "practice" : "practice",
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
        mode: practiceMode === "exam" ? "exam" : "practice",
        variant: practiceMode,
        subject: subject === "Combined" ? "Combined" : subject,
        subskill: subskill || null,
        totalQuestions: total,
        answeredCount: answered,
        correctCount: correct,
        durationSeconds: Math.max(0, Math.round((Date.now() - examStartedAtMs) / 1000)),
        outcome: sessionAnalysis.outcome,
        scoreBandLow: scoreBand.low,
        scoreBandHigh: scoreBand.high,
        topics: buildTopicSnapshots(source),
      });
      setHistorySessionId(history.sessionId);
    } catch (e: unknown) {
      setSessionPayoff(null);
      setEngagementNotice(errorMessage(e, "Session results saved, but durable engagement sync failed."));
    }

    setMode("done");
    setToolsOpen(false);
  }, [answers, sessionClientId, total, practiceMode, subject, subskill, examStartedAtMs, sessionAnalysis.outcome, scoreBand.low, scoreBand.high]);

  const finalizeExamSession = useCallback(async (args?: { forceAutoFill?: boolean }) => {
    if (!questions.length || saving) return;
    setSaving(true);
    setErr(null);

    try {
      const working = { ...examDraftAnswers };
      const unanswered = questions.filter((question) => !working[question.id]);
      if (unanswered.length > 0 && args?.forceAutoFill) {
        for (const question of unanswered) {
          working[question.id] = autoOptionForQuestion(question.id);
        }
        setTimingNotice(`Exam submitted with ${unanswered.length} auto-filled unanswered question(s).`);
      } else if (unanswered.length > 0) {
        setErr(`You still have ${unanswered.length} unanswered question(s). Answer or auto-fill by submitting after timer expires.`);
        setSaving(false);
        return;
      }

      const now = Date.now();
      const elapsed = Math.max(1, Math.round((now - examStartedAtMs) / 1000));
      const avgPerQuestion = Math.max(5, Math.round(elapsed / Math.max(questions.length, 1)));

      const nextAnswers: Record<string, AnswerInsert> = {};
      for (const question of questions) {
        const chosen = working[question.id]!;
        const recorded = await recordAnswerEvent({
          questionId: question.id,
          selectedOption: chosen,
          mode: "practice",
          timeTakenSeconds: avgPerQuestion,
        });

        nextAnswers[question.id] = {
          question_id: question.id,
          selected_option: recorded.selectedOption,
          is_correct: recorded.isCorrect,
          is_review: false,
          time_taken_seconds: avgPerQuestion,
          subject: question.subject || subject,
          topic: question.topic ?? (subskill || null),
        };
      }

      setAnswers(nextAnswers);
      setExamDraftAnswers(working);
      setMomentum((prev) => ({
        ...prev,
        answered: questions.length,
        total: questions.length,
        progressPct: 100,
      }));
      await finishSession(nextAnswers);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to finalize exam session."));
    } finally {
      setSaving(false);
    }
  }, [examDraftAnswers, examStartedAtMs, finishSession, questions, saving, subject, subskill]);

  const jumpToQuestion = useCallback((nextIdx: number) => {
    const safe = Math.max(0, Math.min(questions.length - 1, nextIdx));
    setIdx(safe);
    if (practiceMode === "exam") {
      const nextQuestionId = questions[safe]?.id;
      setSelected(nextQuestionId ? examDraftAnswers[nextQuestionId] ?? null : null);
    }
    setAiExplain(null);
    setAiExplainError(null);
    setAiExplainLoading(false);
  }, [examDraftAnswers, practiceMode, questions]);

  const submitAnswer = useCallback(async (args?: {
    forcedOption?: string;
    timedOut?: boolean;
    forceFinish?: boolean;
  }) => {
    if (!q) return;
    if (saving) return;
    if (practiceMode !== "exam" && locked) return;

    const chosen = (args?.forcedOption || selected || "").toUpperCase();
    if (!["A", "B", "C", "D"].includes(chosen)) return;

    if (practiceMode === "exam") {
      setExamDraftAnswers((prev) => ({ ...prev, [q.id]: chosen }));
      setSelected(chosen);
      if (args?.forceFinish) {
        await finalizeExamSession({ forceAutoFill: true });
        return;
      }
      const isLast = idx >= questions.length - 1;
      if (isLast) {
        await finalizeExamSession({ forceAutoFill: false });
      } else {
        jumpToQuestion(idx + 1);
      }
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      const timeTaken = elapsedSecondsFrom(startedAt);
      const recorded = await recordAnswerEvent({
        questionId: q.id,
        selectedOption: chosen,
        mode: "practice",
        timeTakenSeconds: timeTaken,
      });

      const nextAnswers: Record<string, AnswerInsert> = {
        ...answers,
        [q.id]: {
          question_id: q.id,
          selected_option: recorded.selectedOption,
          is_correct: recorded.isCorrect,
          is_review: false,
          time_taken_seconds: timeTaken,
          subject: q.subject || subject,
          topic: q.topic ?? (subskill || null),
        },
      };

      setAnswers(nextAnswers);

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

      if (args?.timedOut) {
        setSelected(chosen);
      }

      setLocked(true);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to record practice answer."));
    } finally {
      setSaving(false);
    }
  }, [
    answers,
    finalizeExamSession,
    idx,
    jumpToQuestion,
    locked,
    practiceMode,
    q,
    questions.length,
    saving,
    selected,
    startedAt,
    subject,
    subskill,
  ]);

  async function submit() {
    await submitAnswer();
  }

  useEffect(() => {
    if (mode !== "in_session") return;
    if (practiceMode !== "timed") return;
    if (locked || saving) return;
    if (questionSecondsLeft === null) return;

    if (questionSecondsLeft <= 0) {
      const forced = selected?.toUpperCase() || autoOptionForQuestion(q?.id || "fallback");
      const timeout = window.setTimeout(() => {
        setTimingNotice(`Time expired. Auto-locked on ${forced}.`);
        setQuestionSecondsLeft(null);
        void submitAnswer({ forcedOption: forced, timedOut: true });
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const timer = window.setTimeout(() => {
      setQuestionSecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [mode, practiceMode, questionSecondsLeft, locked, saving, selected, q, submitAnswer]);

  useEffect(() => {
    if (mode !== "in_session") return;
    if (practiceMode !== "exam") return;
    if (saving) return;
    if (examSecondsLeft === null) return;

    if (examSecondsLeft <= 0) {
      const timeout = window.setTimeout(() => {
        setTimingNotice("Exam time expired. Submitting exam shell now.");
        setExamSecondsLeft(null);
        void finalizeExamSession({ forceAutoFill: true });
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const timer = window.setTimeout(() => {
      setExamSecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [mode, practiceMode, examSecondsLeft, saving, finalizeExamSession]);

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
        subject,
        subskill: subskill || q.topic || null,
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

  async function nextOrFinish() {
    if (!q) return;

    const isLast = idx >= questions.length - 1;
    if (isLast) {
      await finishSession();
      return;
    }

    setIdx((i) => i + 1);
    if (practiceMode === "timed") {
      setQuestionSecondsLeft(questionTimeLimitSeconds((questions[idx + 1]?.subject as "Reading" | "Math" | "Combined") || subject));
    }
    resetQuestionUI();
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

  const subjectSummary =
    subject === "Combined"
      ? "Reading + Math mixed"
      : subskill
      ? `${subject} targeted run`
      : `${subject} focus`;

  const modeLabel =
    practiceMode === "trainer" ? "Trainer" : practiceMode === "timed" ? "Timed" : "Exam";

  const modePill =
    practiceMode === "timed"
      ? `Q ${formatClock(questionSecondsLeft ?? 0)}`
      : practiceMode === "exam"
      ? `Exam ${formatClock(examSecondsLeft ?? 0)}`
      : `Accuracy ${accuracyPct}%`;

  return (
    <main className="min-h-screen">
      <PageHeader
        label={subskill ? "Targeted training" : "Fresh practice"}
        title="Practice"
        subtitle={
          subskill
            ? `${subjectSummary} • ${modeLabel} mode • focused on ${subskill}`
            : `${subjectSummary} • ${modeLabel} mode • focused 12-question session`
        }
        right={
          <button
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
            onClick={() => router.push("/today")}
          >
            Back
          </button>
        }
      />

      {!loading && !err && (
        <LoopRail
          active="Practice"
          note="Practice creates signal. Review decides what must come back."
        />
      )}

      {loading && (
        <Card title="Loading…" subtitle="Preparing your session">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Practice could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={ensureAuthAndLoad}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && mode === "setup" && questions.length > 0 && (
        <div className="grid gap-4">
          {engagementNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {engagementNotice}
            </div>
          )}

          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Session launchpad
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Commit to one full block</h2>
                <p className="mt-2 text-sm text-[#d2dbec]">Pick pressure mode, then finish without context switching.</p>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {(["Reading", "Math", "Combined"] as const).map((option) => {
                    const active = subject === option;
                    const note =
                      option === "Reading"
                        ? "Reading-only block"
                        : option === "Math"
                        ? "Math-only block"
                        : "Mixed Reading + Math block";

                    return (
                      <button
                        key={option}
                        onClick={() => switchSubject(option)}
                        className={[
                          "rounded-xl border p-4 text-left transition",
                          active
                            ? "border-[#8ab8ff] bg-white text-[#0f1b33] shadow-sm"
                            : "border-[#3e557e] bg-white/5 text-white hover:border-[#5f7dae] hover:bg-white/10",
                        ].join(" ")}
                      >
                        <div className={`text-sm font-semibold ${active ? "text-[#0f1b33]" : "text-white"}`}>{option}</div>
                        <div className={`mt-2 text-xs ${active ? "text-[#1f3358]" : "text-[#cfdbf3]"}`}>{note}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {PRACTICE_MODES.map((m) => {
                    const active = practiceMode === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setPracticeMode(m.key)}
                        className={[
                          "rounded-xl border p-4 text-left transition",
                          active
                            ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33] shadow-sm"
                            : "border-[#3e557e] bg-white/5 text-white hover:border-[#5f7dae] hover:bg-white/10",
                        ].join(" ")}
                      >
                        <div className={`text-sm font-semibold ${active ? "text-[#0f1b33]" : "text-white"}`}>{m.label}</div>
                        <div className={`mt-2 text-xs ${active ? "text-[#23375d]" : "text-[#cfdbf3]"}`}>{m.note}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-sm text-[#cbd8f0]">
                    Subject: <span className="font-semibold text-white">{subject}</span>
                  </div>
                  <div className="rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-sm text-[#cbd8f0]">
                    Mode: <span className="font-semibold text-white">{modeLabel}</span>
                  </div>
                  <div className="rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-sm text-[#cbd8f0]">
                    Questions: <span className="font-semibold text-white">{limit}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={startSession}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#ecf3ff]"
                  >
                    Start session
                  </button>
                  <Link
                    href="/today"
                    className="inline-flex items-center justify-center rounded-xl border border-[#506894] bg-white/5 px-4 py-3 text-sm font-semibold text-[#d7e3fb] transition hover:border-[#6f8ec7] hover:bg-white/10"
                  >
                    Back to Today
                  </Link>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Score band</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                    {scoreBand.low}–{scoreBand.high}
                  </div>
                  <div className="mt-2 text-xs text-[#c8d4ed]">
                    {scoreBand.confidence} confidence • {scoreBand.signalAnswers} answers backing estimate
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Payoff model</div>
                  <div className="mt-2 text-sm text-[#d2dbec]">Base accuracy XP + completion bonus + combo pressure.</div>
                  {identity && identityStatus && (
                    <div className="mt-3 text-xs text-[#c8d4ed]">
                      {identityStatus.division.label} L{identityStatus.level} • {identity.streakDays}d streak
                    </div>
                  )}
                </div>

                {subskill && (
                  <Link
                    href={`/lesson/${encodeURIComponent(subskill)}`}
                    className="inline-flex items-center justify-center rounded-xl border border-[#506894] bg-white/5 px-4 py-3 text-sm font-semibold text-[#d7e3fb] transition hover:border-[#6f8ec7] hover:bg-white/10"
                  >
                    Open lesson before run
                  </Link>
                )}
              </div>
            </div>

            {(subject === "Math" || subject === "Combined") && (
              <div className="border-t border-white/10 bg-black/10 p-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">SAT tool layer</div>
                    <div className="mt-1 text-sm font-semibold text-white">Formula + calculator strategy available in-session</div>
                  </div>
                  <button
                    onClick={() => setToolsOpen(true)}
                    className="rounded-lg border border-[#4f6693] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb]"
                  >
                    Open tools
                  </button>
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
                {subject === "Combined" ? `${q.subject} live` : modeLabel} • Question {Math.min(idx + 1, total)} / {total}
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill text={modePill} tone={practiceMode === "trainer" ? "neutral" : "accent"} />
                <Pill text={`Combo ${momentum.combo}`} tone={momentum.currentStreak >= 4 ? "success" : "neutral"} />
                {hasMathTools && (
                  <button
                    onClick={() => setToolsOpen(true)}
                    className="rounded-full border border-[#4f6795] bg-white/10 px-3 py-1 text-xs font-semibold text-[#d7e3fb] transition hover:bg-white/20"
                  >
                    Tools
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 h-2.5 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#7eb5ff,#b9d9ff)]"
                style={{ width: `${momentum.progressPct}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#c8d4ed]">
              <div>Answered {practiceMode === "exam" ? examAnsweredCount : answeredCount}</div>
              <div>Correct {correctCount}</div>
              <div className="text-right">Session XP {momentum.sessionXp}</div>
            </div>
            {practiceMode === "exam" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-xs text-[#cedaf1]">
                  Marked: <span className="font-semibold text-white">{examMarkedCount}</span>
                </div>
                <div className="rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-xs text-[#cedaf1]">
                  Unanswered: <span className="font-semibold text-white">{Math.max(total - examAnsweredCount, 0)}</span>
                </div>
                <button
                  onClick={() => void finalizeExamSession({ forceAutoFill: false })}
                  disabled={saving}
                  className="rounded-lg border border-[#4f6795] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb] disabled:opacity-60"
                >
                  Submit exam now
                </button>
              </div>
            )}
          </div>

          {timingNotice && (
            <div className="rounded-2xl border border-[#f2c67b] bg-[#fff4e2] p-4 text-sm text-[#8f5c0e]">
              {timingNotice}
            </div>
          )}

          <Card
            title="Current item"
            subtitle={
              practiceMode === "exam"
                ? "Strict lock mode. Correctness reveals at block end."
                : subskill
                ? `Focused run: ${subskill}`
                : "Focused practice block"
            }
            accent
            prominence="prominent"
          >
            <div className="text-lg font-medium leading-relaxed whitespace-pre-line text-[#0f172a]">
              {q.question_text}
            </div>

            {practiceMode === "exam" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={toggleExamMarkCurrent}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    examMarked[q.id] ? "border-[#1a2f58] bg-[#edf5ff] text-[#0f1b33]" : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  {examMarked[q.id] ? "Marked for review" : "Mark for review"}
                </button>
                <button
                  onClick={() => setExamDraftAnswers((prev) => {
                    const next = { ...prev };
                    delete next[q.id];
                    setSelected(null);
                    return next;
                  })}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Clear answer
                </button>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const chosen = selected === letter;
                const correct = locked && feedback && feedback.correct && q.correct_option.toUpperCase() === letter;
                const wrongChosen = locked && chosen && feedback && !feedback.correct;

                let cls = "border border-gray-200 bg-white shadow-sm";
                if (chosen) cls = "border-[#0f1b33] bg-[#edf5ff] shadow-md";
                if (correct) cls = "border-[#2a9b67] bg-[#edfcf3] shadow-md";
                if (wrongChosen) cls = "border-[#d54768] bg-[#fff2f5] shadow-md";

                return (
                  <button
                    key={letter}
                    onClick={() => pick(letter)}
                    className={`w-full rounded-2xl p-4 text-left transition ${cls}`}
                    disabled={saving || (practiceMode !== "exam" && locked)}
                  >
                    <div className="mb-1 text-xs font-semibold text-gray-500">{letter}</div>
                    <div className="text-sm text-gray-900">{optionText(letter)}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              {practiceMode === "exam" ? (
                <button
                  className="w-full rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  {idx === total - 1 ? (saving ? "Saving…" : "Save & submit exam") : saving ? "Saving…" : "Save & next"}
                </button>
              ) : !locked ? (
                <button
                  className="w-full rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  Submit answer
                </button>
              ) : (
                <button
                  className="w-full rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a] disabled:opacity-60 sm:w-auto"
                  onClick={nextOrFinish}
                  disabled={saving}
                >
                  {idx === total - 1 ? (saving ? "Saving…" : "Finish session") : "Next question"}
                </button>
              )}
            </div>

            {practiceMode !== "exam" && locked && feedback && (
              <div className={`mt-5 rounded-2xl border p-5 ${feedback.correct ? "border-[#9de0bb] bg-[#ebfdf2]" : "border-[#f5b8c4] bg-[#fff2f5]"}`}>
                <div className={`font-semibold ${feedback.correct ? "text-[#0f8a4e]" : "text-[#b02039]"}`}>
                  {feedback.correct ? "Correct. Keep the run alive." : "Miss. Recover immediately."}
                </div>
                <div className="mt-1 text-xs text-gray-700">+{momentum.instantXp} XP • Combo {momentum.combo}</div>

                {!feedback.correct && (
                  <div className="mt-2 text-sm text-gray-700">
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

                <div className="mt-3">
                  <QuestionActionBlock
                    mode="practice"
                    questionId={q.id}
                    subject={subject}
                    subskill={subskill || q.topic || undefined}
                    onExplain={generateAiExplanation}
                    aiExplainLoading={aiExplainLoading}
                    aiExplainError={aiExplainError}
                    aiExplain={aiExplain}
                    footerNote="Practice creates signal. Review handles later recovery."
                  />
                </div>
              </div>
            )}
          </Card>

          {practiceMode === "exam" && (
            <Card title="Question navigator" subtitle="Jump between items, revisit marked questions, then submit.">
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
                {questions.map((question, qIdx) => {
                  const isCurrent = idx === qIdx;
                  const isMarked = !!examMarked[question.id];
                  const isAnswered = !!examDraftAnswers[question.id];
                  return (
                    <button
                      key={question.id}
                      onClick={() => jumpToQuestion(qIdx)}
                      className={[
                        "rounded-lg border px-2 py-2 text-xs font-semibold transition",
                        isCurrent
                          ? "border-[#0f1b33] bg-[#0f1b33] text-white"
                          : isMarked
                          ? "border-[#6b7893] bg-[#eef3fb] text-[#0f1b33]"
                          : isAnswered
                          ? "border-[#9de0bb] bg-[#ebfdf2] text-[#0f8a4e]"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {qIdx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                <div>Answered {examAnsweredCount}/{total}</div>
                <div>Marked {examMarkedCount}</div>
                <div>Unanswered {Math.max(total - examAnsweredCount, 0)}</div>
              </div>
            </Card>
          )}

        </div>
      )}

      {!loading && !err && mode === "done" && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Session complete
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {sessionOutcome?.title ?? "Execution complete"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                  {sessionOutcome?.note ?? "Choose the next route while the signal is still fresh."}
                </p>
                <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Score: <span className="font-semibold text-white">{correctCount}/{total}</span>
                  </div>
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Accuracy: <span className="font-semibold text-white">{sessionAnalysis.accuracyPct}%</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Predicted score band</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{scoreBand.low}–{scoreBand.high}</div>
                  <div className="mt-1 text-xs text-[#c8d4ed]">{scoreBand.confidence} confidence estimate</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Next execution</div>
                  <div className="mt-2 text-sm text-[#d2dbec]">
                    {repairTopic ? `Primary repair target: ${repairTopic}` : "No single failed topic dominated this set."}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card
            title="Practice session complete"
            subtitle="Execution complete. Choose the next route while the signal is fresh."
            right={sessionOutcome ? <Pill text={sessionOutcome.title} tone={sessionOutcome.tone} /> : null}
            accent
            prominence="prominent"
          >
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatBox
                    label="Score"
                    value={`${correctCount}/${total}`}
                    hint="Correct / total"
                    accent={accuracyPct >= 50}
                    size={accuracyPct >= 50 ? "large" : "default"}
                  />
                  <StatBox
                    label="Accuracy"
                    value={`${sessionAnalysis.accuracyPct}%`}
                    hint="This session"
                    accent={accuracyPct >= 75}
                    size={accuracyPct >= 75 ? "large" : "default"}
                  />
                </div>
                <div className="mt-4 text-sm text-gray-700">
                  Predicted band <span className="font-semibold text-black">{scoreBand.low}–{scoreBand.high}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  {scoreBand.confidence} confidence
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Next execution</div>
                <div className="mt-2 text-sm text-gray-700">
                  {repairTopic
                    ? `Primary repair target: ${repairTopic}`
                    : "No single failed topic dominated this set."}
                </div>
                <div className="mt-4 grid gap-3">
                  <PrimaryButton href={repairTopic ? repairPracticeHref : undefined} onClick={repairTopic ? undefined : ensureAuthAndLoad}>
                    {repairTopic ? "Run targeted repair" : "Run next set"}
                  </PrimaryButton>
                  <SecondaryButton href={repairTopic ? repairLessonHref : "/review"}>
                    {repairTopic ? "Open lesson" : "Open review"}
                  </SecondaryButton>
                </div>
              </div>
            </div>

            {sessionOutcome && (
              <div
                className={`mt-6 rounded-2xl border-2 p-5 ${
                  sessionOutcome.tone === "danger"
                    ? "border-red-300 bg-red-50"
                    : sessionOutcome.tone === "accent"
                    ? "border-[#c7dbff] bg-[#f6faff]"
                    : "border-green-300 bg-green-50"
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    sessionOutcome.tone === "danger"
                      ? "text-red-700"
                      : sessionOutcome.tone === "accent"
                      ? "text-[#004aad]"
                      : "text-green-700"
                  }`}
                >
                  {sessionOutcome.title}
                </div>
                <div className="mt-2 text-sm leading-relaxed text-gray-700">{sessionOutcome.note}</div>
              </div>
            )}

            {sessionPayoff && identityStatus && identity && (
              <SessionPayoffCard
                payoff={sessionPayoff}
                status={identityStatus}
                streakDays={identity.streakDays}
                mode="practice"
              />
            )}

            {engagementNotice && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                {engagementNotice}
              </div>
            )}

            {identityStatus && identity && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                {identityStatus.division.label} • Level {identityStatus.level} • Streak {identity.streakDays}d
                {identityStatus.nextDivision && (
                  <span className="ml-2 text-gray-500">({pointsToNextDivision(identity)} XP to {identityStatus.nextDivision.label})</span>
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

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {historySessionId ? (
                <PrimaryButton href={`/history?session=${encodeURIComponent(historySessionId)}`}>Reopen this result</PrimaryButton>
              ) : (
                <SecondaryButton href="/history">Open history</SecondaryButton>
              )}
              <SecondaryButton href="/skills">Open skills</SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
              <SecondaryButton href="/review">Open review queue</SecondaryButton>
              <SecondaryButton href="/coach">Open coach</SecondaryButton>
            </div>
          </Card>
        </div>
      )}

      <MathToolsLayer
        open={toolsOpen && hasMathTools}
        onClose={() => setToolsOpen(false)}
        topicHint={toolsTopicHint}
        modeLabel={modeLabel}
      />
    </main>
  );
}
