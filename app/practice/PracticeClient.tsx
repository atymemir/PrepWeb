'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "../lib/supabase";
import { confidenceLabel } from "../lib/learningSignals";
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
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import QuestionActionBlock from "../components/QuestionActionBlock";
import { IdentityStatusCard, MomentumRail, SessionPayoffCard } from "../components/EngagementSystem";

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

function questionTimeLimitSeconds(subject: "Reading" | "Math"): number {
  return subject === "Reading" ? 70 : 95;
}

function examTimeLimitSeconds(subject: "Reading" | "Math", questionCount: number): number {
  return questionTimeLimitSeconds(subject) * Math.max(1, questionCount);
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

  const subject = (sp.get("subject") || "Reading") as "Reading" | "Math";
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

  const [questionSecondsLeft, setQuestionSecondsLeft] = useState<number | null>(null);
  const [examSecondsLeft, setExamSecondsLeft] = useState<number | null>(null);

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
  const incorrectCount = sessionAnalysis.incorrectCount;
  const accuracyPct = sessionAnalysis.accuracyPct;

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
    if (!repairTopic) return subject;
    const found = Object.values(answers).find(
      (answer) => (answer.topic?.trim() || "Unknown") === repairTopic
    );
    return (found?.subject as "Reading" | "Math") || subject;
  }, [answers, repairTopic, subject]);

  const repairPracticeHref = repairTopic
    ? `/practice?subject=${repairSubject}&subskill=${encodeURIComponent(repairTopic)}`
    : `/practice?subject=${subject}`;
  const repairLessonHref = repairTopic ? `/lesson/${encodeURIComponent(repairTopic)}` : "/lessons";

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
    setSelected(null);
    setLocked(false);
    setFeedback(null);
    setAiExplain(null);
    setAiExplainError(null);
    setAiExplainLoading(false);
    setStartedAt(Date.now());
  }

  function resetTimingState(questionCount: number) {
    setTimingNotice(null);
    if (practiceMode === "timed") {
      setQuestionSecondsLeft(questionTimeLimitSeconds(subject));
      setExamSecondsLeft(null);
      return;
    }

    if (practiceMode === "exam") {
      setQuestionSecondsLeft(null);
      setExamSecondsLeft(examTimeLimitSeconds(subject, questionCount));
      return;
    }

    setQuestionSecondsLeft(null);
    setExamSecondsLeft(null);
  }

  function pick(letter: string) {
    if (locked || saving) return;
    setSelected(letter);
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
        p_subject: subject,
        p_subskill: subskill,
        p_limit: limit,
      });

      if (error) throw new Error(error.message);

      const list = (data ?? []) as Question[];
      if (!list.length) throw new Error("No questions returned for this filter.");

      setQuestions(list);
      setIdx(0);
      setAnswers({});
      setMomentum(createMomentum(list.length || limit));
      setSessionPayoff(null);
      setShareText("");
      setCopiedShare(false);
      setSessionClientId(createClientSessionId());
      resetQuestionUI();
      resetTimingState(list.length || limit);
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

  function startSession() {
    setMode("in_session");
    setIdx(0);
    setAnswers({});
    setMomentum(createMomentum(questions.length || limit));
    setSessionPayoff(null);
    setShareText("");
    setCopiedShare(false);
    setSessionClientId(createClientSessionId());
    resetQuestionUI();
    resetTimingState(questions.length || limit);
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
          mode: "practice",
          correct,
          answered,
          accuracyPct: applied.payoff.accuracyPct,
          streakDays: applied.identity.streakDays,
          level: applied.status.level,
          division: applied.status.division.label,
        })
      );
    } catch (e: unknown) {
      setSessionPayoff(null);
      setEngagementNotice(errorMessage(e, "Session results saved, but durable engagement sync failed."));
    }

    setMode("done");
  }, [answers, sessionClientId, total]);

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

      if (practiceMode === "exam") {
        const isLast = idx >= questions.length - 1;
        if (isLast || args?.forceFinish) {
          await finishSession(nextAnswers);
        } else {
          setIdx((i) => i + 1);
          resetQuestionUI();
        }
        return;
      }

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
    finishSession,
    idx,
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
      const forced = selected?.toUpperCase() || autoOptionForQuestion(q?.id || "fallback");
      const timeout = window.setTimeout(() => {
        setTimingNotice(
          selected
            ? "Exam time expired. Current answer was auto-submitted and block ended."
            : `Exam time expired. Auto-locked on ${forced} and block ended.`
        );
        setExamSecondsLeft(null);
        void submitAnswer({ forcedOption: forced, timedOut: true, forceFinish: true });
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const timer = window.setTimeout(() => {
      setExamSecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [mode, practiceMode, examSecondsLeft, saving, selected, q, submitAnswer]);

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
      setQuestionSecondsLeft(questionTimeLimitSeconds(subject));
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
            ? `${subject} • ${modeLabel} mode • focused on ${subskill}`
            : `${subject} • ${modeLabel} mode • focused 12-question session`
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
          {identity && identityStatus && (
            <IdentityStatusCard
              identity={identity}
              status={identityStatus}
              title="Engagement system"
              subtitle={`${identityStatus.division.label} • Level ${identityStatus.level}`}
              note="Daily consistency, session quality, and completion discipline now feed one visible identity track."
            />
          )}

          {engagementNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {engagementNotice}
            </div>
          )}

          <Card
            title="Predicted score band"
            subtitle="Range estimate only. It updates from real recorded performance, not hype math."
            right={<Pill text={`${scoreBand.confidence} confidence`} tone="accent" />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <StatBox label="Estimated range" value={`${scoreBand.low}–${scoreBand.high}`} hint="SAT total (range)" accent />
              <StatBox label="Center" value={`${scoreBand.center}`} hint="Middle of current estimate" />
              <StatBox label="Signal size" value={`${scoreBand.signalAnswers}`} hint="Recorded answers behind this range" />
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              This estimate is deliberately conservative and band-based. Wider bands mean the signal is still thin.
            </div>
          </Card>

          <Card
            title="Practice mode"
            subtitle="Choose the pressure profile before you start."
            right={<Pill text={modeLabel} tone="accent" />}
          >
            <div className="grid gap-3 md:grid-cols-3">
              {PRACTICE_MODES.map((m) => {
                const active = practiceMode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setPracticeMode(m.key)}
                    className={[
                      "rounded-xl border p-4 text-left transition",
                      active
                        ? "border-[#004aad] bg-[#eef4ff]"
                        : "border-gray-200 bg-white hover:border-gray-300",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold text-black">{m.label}</div>
                    <div className="mt-2 text-xs leading-relaxed text-gray-700">{m.note}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              {practiceMode === "trainer" && (
                <span>Trainer mode is explanation-forward and best for targeted repair cycles.</span>
              )}
              {practiceMode === "timed" && (
                <span>
                  Timed mode sets {formatClock(questionTimeLimitSeconds(subject))} per question in this {subject} block.
                </span>
              )}
              {practiceMode === "exam" && (
                <span>
                  Exam mode sets one strict {formatClock(examTimeLimitSeconds(subject, limit))} block timer and hides correctness until completion.
                </span>
              )}
            </div>
          </Card>

          <Card
            title="Session setup"
            subtitle="Confirm the mission, lock the first win quickly, and finish clean for full payoff."
            right={<Pill text={subskill ? "Targeted" : "General"} tone="accent" />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox label="Subject" value={subject} hint="Selected practice track" accent />
              <StatBox
                label="Mode"
                value={modeLabel}
                hint={practiceMode === "trainer" ? "Feedback-forward" : practiceMode === "timed" ? "Per-question pressure" : "Strict simulation"}
              />
              <StatBox label="Questions" value={String(limit)} hint="Fixed session size" />
              <StatBox
                label="Signal"
                value={confidenceLabel(limit)}
                hint="Good enough to guide next action"
              />
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-black">What happens in this session</div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">
                You will do a clean 12-question set. Each submitted answer is recorded to backend truth and still feeds review scheduling.
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[#c7dbff] bg-[#f6faff] px-3 py-2 text-xs text-[#004aad]">
                  Instant reward: <span className="font-semibold">XP + combo</span>
                </div>
                <div className="rounded-lg border border-[#c7dbff] bg-[#f6faff] px-3 py-2 text-xs text-[#004aad]">
                  Finish bonus: <span className="font-semibold">+36 XP</span>
                </div>
                <div className="rounded-lg border border-[#c7dbff] bg-[#f6faff] px-3 py-2 text-xs text-[#004aad]">
                  Accuracy bonus: <span className="font-semibold">up to +22 XP</span>
                </div>
              </div>

              {subskill && (
                <div className="mt-3 text-sm leading-relaxed text-gray-700">
                  This run is focused on <span className="font-semibold">{subskill}</span>, so the goal is
                  not broad coverage — it is cleaner repair of one weak zone.
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PrimaryButton onClick={startSession}>Start session</PrimaryButton>
              <SecondaryButton href="/skills">Open skills</SecondaryButton>
              {subskill ? (
                <SecondaryButton href={`/lesson/${encodeURIComponent(subskill)}`}>Open lesson</SecondaryButton>
              ) : (
                <SecondaryButton href={`/practice?subject=${subject === "Reading" ? "Math" : "Reading"}`}>
                  Switch subject
                </SecondaryButton>
              )}
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && mode === "in_session" && q && (
        <div className="grid gap-4">
          <MomentumRail
            momentum={momentum}
            title="Session momentum"
            subtitle={
              practiceMode === "exam"
                ? "Strict mode active. No correctness reveal until block completion."
                : "Protect the combo and keep energy high through the final question."
            }
          />

          {timingNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {timingNotice}
            </div>
          )}

          <Card
            title={`Question ${Math.min(idx + 1, total)} / ${total}`}
            subtitle={
              practiceMode === "exam"
                ? "Exam mode: no instant correctness feedback during the block."
                : subskill
                ? `Focused on ${subskill}`
                : "General practice flow"
            }
            right={<Pill text={modePill} tone={practiceMode === "trainer" ? "neutral" : "accent"} />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox label="Answered" value={`${answeredCount}`} hint="Completed so far" />
              <StatBox label="Correct" value={`${correctCount}`} hint="Right answers" accent={correctCount > 0} />
              <StatBox label="Remaining" value={`${Math.max(total - answeredCount, 0)}`} hint="Still ahead" />
              <StatBox
                label="Timer"
                value={
                  practiceMode === "timed"
                    ? formatClock(questionSecondsLeft ?? 0)
                    : practiceMode === "exam"
                    ? formatClock(examSecondsLeft ?? 0)
                    : "Open"
                }
                hint={practiceMode === "trainer" ? "No timer pressure" : "Pressure active"}
              />
            </div>
          </Card>

          <Card
            title="Current item"
            subtitle={
              practiceMode === "exam"
                ? "Choose once and lock. You will see correctness at the end of the block."
                : "Choose the best answer, then inspect the explanation."
            }
          >
            <div className="text-base font-medium leading-relaxed whitespace-pre-line text-black">
              {q.question_text}
            </div>

            <div className="mt-6 space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const chosen = selected === letter;
                const correct = locked && feedback && feedback.correct && q.correct_option.toUpperCase() === letter;
                const wrongChosen = locked && chosen && feedback && !feedback.correct;

                let cls = "border border-gray-200 bg-white";
                if (chosen) cls = "border-[#004aad] bg-[#eef4ff]";
                if (correct) cls = "border-green-600 bg-green-50";
                if (wrongChosen) cls = "border-red-600 bg-red-50";

                return (
                  <button
                    key={letter}
                    onClick={() => pick(letter)}
                    className={`w-full rounded-xl p-4 text-left ${cls}`}
                    disabled={saving || (practiceMode !== "exam" && locked)}
                  >
                    <div className="mb-1 text-xs font-semibold text-gray-500">{letter}</div>
                    <div className="text-sm text-gray-900">{optionText(letter)}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3 items-start">
              {practiceMode === "exam" ? (
                <button
                  className="rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88] disabled:opacity-60"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  {idx === total - 1 ? (saving ? "Saving…" : "Submit & finish") : saving ? "Saving…" : "Lock answer"}
                </button>
              ) : !locked ? (
                <button
                  className="rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88] disabled:opacity-60"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  Submit
                </button>
              ) : (
                <button
                  className="rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88] disabled:opacity-60"
                  onClick={nextOrFinish}
                  disabled={saving}
                >
                  {idx === total - 1 ? (saving ? "Saving…" : "Finish") : "Next"}
                </button>
              )}

              {practiceMode !== "exam" && locked && feedback && (
                <div className="flex-1 rounded-xl border border-gray-200 p-4">
                  <div className={`font-semibold ${feedback.correct ? "text-green-700" : "text-red-700"}`}>
                    {feedback.correct ? "Correct" : "Incorrect"}
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
                    mode="practice"
                    questionId={q.id}
                    subject={subject}
                    subskill={subskill || q.topic || undefined}
                    onExplain={generateAiExplanation}
                    aiExplainLoading={aiExplainLoading}
                    aiExplainError={aiExplainError}
                    aiExplain={aiExplain}
                    footerNote="Practice generates forward signal. Review handles later recovery."
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>This session is designed to generate a clean next action.</span>
              <Link href="/review" className="underline hover:text-black">
                Open review
              </Link>
            </div>
          </Card>
        </div>
      )}

      {!loading && !err && mode === "done" && (
        <div className="grid gap-4">
          <Card
            title="Practice session complete"
            subtitle="Your answers were recorded as you worked. Decide the next best move."
            right={sessionOutcome ? <Pill text={sessionOutcome.title} tone={sessionOutcome.tone} /> : null}
            accent
            prominence="prominent"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                hint="This practice session"
                accent={accuracyPct >= 75}
                size={accuracyPct >= 75 ? "large" : "default"}
              />
              <StatBox label="Incorrect" value={`${incorrectCount}`} hint="Likely to feed review" />
              <StatBox label="Signal" value={confidenceLabel(total)} hint="Based on session size" />
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Predicted score band
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-black">
                {scoreBand.low}–{scoreBand.high}
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Confidence: {scoreBand.confidence} • Signal size: {scoreBand.signalAnswers} answers
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

            {repairTopic && (
              <div className="mt-5 rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
                <div className="label label-accent mb-2">Primary repair target</div>
                <div className="mt-1 text-lg font-semibold text-black">{repairTopic}</div>
                <div className="mt-2 text-sm text-gray-700">
                  Subject: {repairSubject}
                  {sessionAnalysis.primaryRepairTarget && (
                    <>
                      {" "}• Accuracy in this session: {Math.round(sessionAnalysis.primaryRepairTarget.accuracy * 100)}%
                      {" "}({sessionAnalysis.primaryRepairTarget.correct}/{sessionAnalysis.primaryRepairTarget.total})
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PrimaryButton href={repairTopic ? repairPracticeHref : undefined} onClick={repairTopic ? undefined : ensureAuthAndLoad}>
                {repairTopic ? "Practice weak topic" : "Run again"}
              </PrimaryButton>
              <SecondaryButton href="/skills">Open skills</SecondaryButton>
              <SecondaryButton href={repairTopic ? repairLessonHref : "/review"}>
                {repairTopic ? "Open lesson" : "Open review"}
              </SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
