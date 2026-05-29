'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { analyzeReviewSession, type SessionAnalysis } from "../lib/sessionAnalysis";
import { requestQuestionExplanation, type AiExplanation } from "../lib/questionExplanation";
import { errorMessage } from "../lib/errors";
import { recordAnswerEvent } from "../lib/answerEvents";
import {
  applyMomentumAnswer,
  createMomentum,
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
import {
  focusedLessonHref,
  focusedPracticeHref,
  masteryFor,
  movementFor,
  type MasteryState,
  type MovementState,
} from "../lib/mastery";
import { resolveLesson } from "../lib/lessonResolver";
import { normalizePlanTier, tierDefinition, type PlanTier } from "../lib/productTiers";
import { useStudentState } from "../lib/useStudentState";
import { buildTopicSnapshots, createClientSessionId } from "../lib/studySessionUtils";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../ui/ui";
import QuestionActionBlock from "../components/QuestionActionBlock";
import MathToolsLayer from "../components/MathToolsLayer";
import StudyFeedbackFX from "../components/StudyFeedbackFX";
import TestingToolsDock from "../components/TestingToolsDock";
import ExamFormulaReferenceSheet from "../components/ExamFormulaReferenceSheet";
import { PracticeAttackCompanion, PracticePayoffCompanion } from "../components/PageVisualCompanions";
import FloatingDesmosCalculator, {
  type DesktopWindowRect,
  type DesmosSessionState,
} from "../components/FloatingDesmosCalculator";

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
type ToolProfile = "learning" | "testing";
type OptionLetter = "A" | "B" | "C" | "D";

type EliminatedOptionsByQuestion = Record<string, Partial<Record<OptionLetter, boolean>>>;

type ExamToolsUiState = {
  calculatorOpen: boolean;
  calculatorMinimized: boolean;
  referenceOpen: boolean;
  desktopRect: DesktopWindowRect;
};

type ScoreBand = {
  low: number;
  high: number;
  center: number;
  confidence: "Low" | "Medium" | "High";
  signalAnswers: number;
};

type SeenQuestionRow = {
  question_id: string;
};

type MasteryProbe = {
  subject: "Reading" | "Math";
  topic: string;
  attempts: number;
  accuracyPct: number;
  mastery: MasteryState;
  movement: MovementState;
};

type ModeIdentity = {
  label: "Quick Practice" | "Weak Skill Practice" | "Timed Set" | "Full Practice Test" | "Revisit";
  launchNote: string;
  finishPayoff: string;
};

type FinishAction = {
  id: "review" | "focused_retry" | "repair_lesson" | "replay" | "next_block";
  label: string;
  note: string;
  href?: string;
  onClick?: () => void;
};

type StartAttackId = "fresh_signal" | "focused_drill" | "timed_block" | "exam_block" | "revisit";

type StartAttackDescriptor = {
  id: StartAttackId;
  label: "Fresh Signal" | "Focused Drill" | "Timed Block" | "Exam Block" | "Revisit";
  mode: PracticeMode;
  needsRevisitPool: boolean;
  requiresSubskill: boolean;
  whyNow: string;
  payoff: string;
};

const DEFAULT_EXAM_CALCULATOR_RECT: DesktopWindowRect = {
  x: 56,
  y: 106,
  width: 540,
  height: 430,
};

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

function isPracticePoolRpcUnavailable(error: { code?: string; message?: string }): boolean {
  const msg = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    msg.includes("get_practice_questions_fresh") ||
    msg.includes("get_practice_questions_revisit") ||
    msg.includes("get_my_seen_practice_questions") ||
    msg.includes("practice_fresh_seen")
  );
}

function isMissingRpc(error: { code?: string; message?: string } | null | undefined, rpcName: string): boolean {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "PGRST202" || message.includes(rpcName.toLowerCase());
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function subskillCandidates(rawSubskill: string): string[] {
  const trimmed = rawSubskill.trim();
  if (!trimmed) return [];
  const canonical = resolveLesson(trimmed)?.key?.trim() || trimmed;
  return [...new Set([trimmed, canonical].filter(Boolean))];
}

export default function PracticeClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { state: studentState, refresh: refreshStudentState } = useStudentState({
    dueLimit: 80,
    historyLimit: 64,
  });

  const subject = (sp.get("subject") || "Reading") as "Reading" | "Math" | "Combined";
  const subskill = sp.get("subskill") || "";
  const includeSeen = sp.get("revisit") === "1";
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
  const [sessionClientId, setSessionClientId] = useState<string>(() => createClientSessionId());
  const [engagementNotice, setEngagementNotice] = useState<string | null>(null);
  const [timingNotice, setTimingNotice] = useState<string | null>(null);
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [examToolsUi, setExamToolsUi] = useState<ExamToolsUiState>({
    calculatorOpen: false,
    calculatorMinimized: false,
    referenceOpen: false,
    desktopRect: DEFAULT_EXAM_CALCULATOR_RECT,
  });
  const [desmosSessionState, setDesmosSessionState] = useState<DesmosSessionState>(null);
  const [eliminatedOptionsByQuestion, setEliminatedOptionsByQuestion] =
    useState<EliminatedOptionsByQuestion>({});

  const [questionSecondsLeft, setQuestionSecondsLeft] = useState<number | null>(null);
  const [examSecondsLeft, setExamSecondsLeft] = useState<number | null>(null);
  const [examDraftAnswers, setExamDraftAnswers] = useState<Record<string, string>>({});
  const [examMarked, setExamMarked] = useState<Record<string, boolean>>({});
  const [examNavFilter, setExamNavFilter] = useState<"all" | "marked" | "unanswered">("all");
  const [examSubmitPanelOpen, setExamSubmitPanelOpen] = useState(false);
  const [examStartedAtMs, setExamStartedAtMs] = useState<number>(() => Date.now());
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const [baselineLastSession, setBaselineLastSession] = useState<EngagementIdentity["lastSession"] | null>(null);
  const [finalAnalysis, setFinalAnalysis] = useState<SessionAnalysis | null>(null);
  const [sessionDebtBefore, setSessionDebtBefore] = useState<number | null>(null);
  const [postSessionDueCount, setPostSessionDueCount] = useState<number | null>(null);
  const [postSessionMasteryProbe, setPostSessionMasteryProbe] = useState<MasteryProbe | null>(null);
  const [postSessionSignalsNotice, setPostSessionSignalsNotice] = useState<string | null>(null);
  const [examNavigatorOpen, setExamNavigatorOpen] = useState(false);
  const [examOptionEliminatorMode, setExamOptionEliminatorMode] = useState(false);
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [planNotice, setPlanNotice] = useState<string | null>(null);

  const q = questions[idx];
  const total = questions.length;
  const tier = useMemo(() => tierDefinition(planTier), [planTier]);

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

  const analysis = finalAnalysis ?? sessionAnalysis;
  const answeredCount = analysis.reviewedCount;
  const correctCount = analysis.correctCount;
  const accuracyPct = analysis.accuracyPct;

  const examAnsweredCount = useMemo(() => Object.keys(examDraftAnswers).length, [examDraftAnswers]);
  const examMarkedCount = useMemo(
    () => Object.values(examMarked).filter(Boolean).length,
    [examMarked]
  );
  const examUnansweredCount = useMemo(
    () => Math.max(total - examAnsweredCount, 0),
    [examAnsweredCount, total]
  );

  const examVisibleQuestionIndices = useMemo(() => {
    return questions
      .map((question, qIdx) => ({ question, qIdx }))
      .filter(({ question }) => {
        if (examNavFilter === "all") return true;
        if (examNavFilter === "marked") return !!examMarked[question.id];
        return !examDraftAnswers[question.id];
      })
      .map((row) => row.qIdx);
  }, [questions, examNavFilter, examMarked, examDraftAnswers]);

  const scoreBand = useMemo(() => {
    return estimateScoreBand({
      lifetimeAnswers: identity?.totalAnswers ?? 0,
      lifetimeCorrect: identity?.totalCorrect ?? 0,
      sessionAnswers: answeredCount,
      sessionCorrect: correctCount,
    });
  }, [identity, answeredCount, correctCount]);

  const repairTopic = analysis.primaryRepairTarget?.topic ?? null;
  const repairSubject = useMemo(() => {
    if (!repairTopic) return subject === "Combined" ? "Reading" : subject;
    const found = Object.values(answers).find(
      (answer) => (answer.topic?.trim() || "Unknown") === repairTopic
    );
    return (found?.subject as "Reading" | "Math") || (subject === "Combined" ? "Reading" : subject);
  }, [answers, repairTopic, subject]);

  const repairPracticeHref = repairTopic
    ? focusedPracticeHref(repairSubject, repairTopic)
    : `/practice?subject=${subject}`;
  const repairLessonHref = repairTopic ? focusedLessonHref(repairTopic) : "/lessons";
  const hasMathTools = subject === "Math" || subject === "Combined" || q?.subject === "Math";
  const toolProfile: ToolProfile =
    practiceMode === "exam" && mode === "in_session" ? "testing" : "learning";
  const toolsTopicHint = q?.topic || subskill || (subject === "Combined" ? q?.subject || "Math" : subject);

  const sessionOutcome = useMemo(() => {
    if (mode !== "done" || total === 0) return null;

    if (analysis.outcome === "rebuild") {
      return {
        title: "Weak signal",
        tone: "danger" as const,
        note: repairTopic
          ? `Do not move on blindly. Repair ${repairTopic}, then test it with a targeted set.`
          : "Do not move on blindly. Open the skills map and repair the weak area first.",
      };
    }

    if (analysis.outcome === "stabilize") {
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
  }, [mode, total, analysis.outcome, repairTopic]);

  const executionDelta = useMemo(() => {
    if (!baselineLastSession) return null;
    return {
      accuracyDelta: analysis.accuracyPct - baselineLastSession.accuracyPct,
      xpDelta: (sessionPayoff?.totalAwarded ?? momentum.sessionXp) - baselineLastSession.xpAwarded,
    };
  }, [baselineLastSession, analysis.accuracyPct, sessionPayoff?.totalAwarded, momentum.sessionXp]);

  const sessionDebtDelta = useMemo(() => {
    if (sessionDebtBefore === null || postSessionDueCount === null) return null;
    return postSessionDueCount - sessionDebtBefore;
  }, [postSessionDueCount, sessionDebtBefore]);

  const reviewDueNow = postSessionDueCount ?? studentState?.reviewDebt.dueCount ?? 0;
  const hasReviewPressure = reviewDueNow > 0;
  const replayIsUseful = Boolean(
    historySessionId &&
      (practiceMode === "exam" || analysis.outcome !== "advance" || (executionDelta?.accuracyDelta ?? 0) < 0)
  );

  let primaryFinishAction: FinishAction;
  const finishSecondaryActions: FinishAction[] = [];

  if (hasReviewPressure) {
    primaryFinishAction = {
      id: "review",
      label: `Clear ${Math.min(reviewDueNow, 12)} review items`,
      note: `${reviewDueNow} mistake${reviewDueNow === 1 ? "" : "s"} now wait in review. Clear this queue first to avoid carrying errors forward.`,
      href: "/review",
    };

    if (repairTopic) {
      finishSecondaryActions.push({
        id: "focused_retry",
        label: `Focused retry: ${repairTopic}`,
        note: "Retest the surfaced weak topic after clearing review.",
        href: repairPracticeHref,
      });
      finishSecondaryActions.push({
        id: "repair_lesson",
        label: "Open repair lesson",
        note: "Patch the weak pattern before your retry.",
        href: repairLessonHref,
      });
    }
  } else if (repairTopic) {
    primaryFinishAction = {
      id: "focused_retry",
      label: `Retry ${repairTopic}`,
      note: "Attack the weak topic immediately while the error pattern is fresh.",
      href: repairPracticeHref,
    };
    finishSecondaryActions.push({
      id: "repair_lesson",
      label: "Open repair lesson",
      note: "Use the lesson to repair this exact weakness before retry.",
      href: repairLessonHref,
    });
  } else {
    primaryFinishAction = {
      id: "next_block",
      label: "Run next practice block",
      note: "No dominant weak topic surfaced, so extend the signal with one more clean set.",
      onClick: () => {
        void ensureAuthAndLoad();
      },
    };
  }

  if (replayIsUseful && historySessionId && finishSecondaryActions.length < 2) {
    finishSecondaryActions.push({
      id: "replay",
      label: "Replay this result",
      note: "Use replay only when you need direct before/after proof.",
      href: `/history?session=${encodeURIComponent(historySessionId)}`,
    });
  }

  const cappedSecondaryActions = finishSecondaryActions.slice(0, 2);

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
    if (practiceMode === "exam" && examOptionEliminatorMode) {
      if (letter === "A" || letter === "B" || letter === "C" || letter === "D") {
        toggleOptionElimination(letter);
      }
      return;
    }
    if (q && eliminatedOptionsByQuestion[q.id]?.[letter as OptionLetter]) {
      setEliminatedOptionsByQuestion((prev) => {
        const current = prev[q.id];
        if (!current || !current[letter as OptionLetter]) return prev;
        return {
          ...prev,
          [q.id]: {
            ...current,
            [letter as OptionLetter]: false,
          },
        };
      });
    }
    setSelected(letter);
    if (practiceMode === "exam" && q && (letter === "A" || letter === "B" || letter === "C" || letter === "D")) {
      setExamDraftAnswers((prev) => ({ ...prev, [q.id]: letter }));
      setExamSubmitPanelOpen(false);
    }
  }

  const toggleOptionElimination = useCallback((letter: OptionLetter) => {
    if (!q || saving) return;

    const questionId = q.id;
    const shouldClearSelected = selected === letter;

    setEliminatedOptionsByQuestion((prev) => {
      const current = prev[questionId] || {};
      const nextValue = !current[letter];
      return {
        ...prev,
        [questionId]: {
          ...current,
          [letter]: nextValue,
        },
      };
    });

    if (shouldClearSelected) {
      setSelected(null);
      if (practiceMode === "exam") {
        setExamDraftAnswers((prev) => {
          if (prev[questionId] !== letter) return prev;
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
      }
    }
  }, [practiceMode, q, saving, selected]);

  const toggleExamDraftSelection = useCallback((letter: OptionLetter) => {
    if (practiceMode !== "exam" || !q || saving) return;

    setEliminatedOptionsByQuestion((prev) => {
      const current = prev[q.id];
      if (!current || !current[letter]) return prev;
      return {
        ...prev,
        [q.id]: {
          ...current,
          [letter]: false,
        },
      };
    });

    setExamDraftAnswers((prev) => {
      const next = { ...prev };
      if (next[q.id] === letter) {
        delete next[q.id];
        setSelected(null);
      } else {
        next[q.id] = letter;
        setSelected(letter);
      }
      return next;
    });
    setExamSubmitPanelOpen(false);
  }, [practiceMode, q, saving]);

  const openToolSurface = useCallback(() => {
    if (toolProfile === "testing") {
      setExamToolsUi((prev) => ({
        ...prev,
        calculatorOpen: true,
        calculatorMinimized: false,
      }));
      return;
    }
    setToolsOpen(true);
  }, [toolProfile]);

  const closeExamCalculator = useCallback(() => {
    setExamToolsUi((prev) => ({
      ...prev,
      calculatorOpen: false,
      calculatorMinimized: false,
    }));
  }, []);

  const minimizeExamCalculator = useCallback(() => {
    setExamToolsUi((prev) => {
      if (!prev.calculatorOpen) return prev;
      return { ...prev, calculatorMinimized: true };
    });
  }, []);

  const restoreExamCalculator = useCallback(() => {
    setExamToolsUi((prev) => ({
      ...prev,
      calculatorOpen: true,
      calculatorMinimized: false,
    }));
  }, []);

  const toggleExamReference = useCallback(() => {
    setExamToolsUi((prev) => ({
      ...prev,
      referenceOpen: !prev.referenceOpen,
    }));
  }, []);

  const toggleExamMarkCurrent = useCallback(() => {
    if (!q) return;
    setExamMarked((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
  }, [q]);

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
        const profileRes = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", session.user.id)
          .single();
        if (!profileRes.error) {
          const resolved = normalizePlanTier((profileRes.data as { plan_tier?: string | null })?.plan_tier ?? "free");
          setPlanTier(resolved);
          if (practiceMode === "exam" && !tierDefinition(resolved).limits.examMode) {
            setPracticeMode("timed");
            setPlanNotice("Exam mode is available on Pro and Ultimate. Switched to Timed mode.");
          } else {
            setPlanNotice(null);
          }
        } else {
          setPlanTier("free");
          setPlanNotice(null);
        }
      } catch {
        setPlanTier("free");
        setPlanNotice(null);
      }

      try {
        const snapshot = await getDurableEngagementSnapshot();
        setIdentity(snapshot.identity);
        setIdentityStatus(snapshot.status);
        setBaselineLastSession(snapshot.identity.lastSession);
        setEngagementNotice(null);
      } catch (engagementErr: unknown) {
        setIdentity(null);
        setIdentityStatus(null);
        setBaselineLastSession(null);
        setEngagementNotice(errorMessage(engagementErr, "Durable engagement backend is unavailable."));
      }
      setPoolNotice(null);

      const usesRevisitPool = includeSeen;
      const usesFreshPool = !usesRevisitPool;
      const fallbackFetchLimit = Math.max(limit * 6, 72);
      let disciplineFallbackNoted = false;

      const noteDisciplineFallback = (message: string) => {
        if (disciplineFallbackNoted) return;
        setPoolNotice(message);
        disciplineFallbackNoted = true;
      };

      const fetchQuestions = async (args: {
        targetSubject: "Reading" | "Math";
        targetSubskill: string | null;
        targetLimit: number;
      }) => {
        const { data, error } = await supabase.rpc("get_practice_questions", {
          p_subject: args.targetSubject,
          p_subskill: args.targetSubskill,
          p_limit: args.targetLimit,
        });
        if (error) throw new Error(error.message);
        return (data ?? []) as Question[];
      };

      const fetchDisciplinedPool = async (args: {
        targetSubject: "Reading" | "Math";
        targetSubskill: string | null;
        targetLimit: number;
        mode: "fresh" | "revisit";
      }): Promise<Question[] | null> => {
        const rpcName =
          args.mode === "fresh"
            ? "get_practice_questions_fresh"
            : "get_practice_questions_revisit";
        const scan = Math.max(args.targetLimit * 8, args.mode === "fresh" ? 96 : 120);

        const payload =
          args.mode === "fresh"
            ? {
                p_subject: args.targetSubject,
                p_subskill: args.targetSubskill,
                p_limit: args.targetLimit,
                p_scan: scan,
              }
            : {
                p_subject: args.targetSubject,
                p_subskill: args.targetSubskill,
                p_limit: args.targetLimit,
                p_scan: scan,
                p_cooldown_minutes: 45,
              };

        const { data, error } = await supabase.rpc(rpcName, payload);
        if (error) {
          if (isPracticePoolRpcUnavailable(error)) {
            noteDisciplineFallback(
              args.mode === "fresh"
                ? "Fresh-pool backend discipline is not fully active yet. Using fallback rotation."
                : "Revisit backend discipline is not fully active yet. Using fallback rotation."
            );
            return null;
          }
          throw new Error(error.message);
        }
        return (data ?? []) as Question[];
      };

      const fetchSeenQuestionIds = async (targetSubject: "Reading" | "Math") => {
        const { data, error } = await supabase.rpc("get_my_seen_practice_questions", {
          p_subject: targetSubject,
          p_topic: null,
          p_limit: 5000,
        });

        if (error) {
          if (isPracticePoolRpcUnavailable(error)) {
            setPoolNotice(
              "Fresh-pool tracking backend is not fully active yet. Using standard question rotation."
            );
            return null;
          }
          throw new Error(error.message);
        }

        const ids = new Set<string>();
        for (const row of ((data ?? []) as SeenQuestionRow[])) {
          ids.add(String(row.question_id));
        }
        return ids;
      };

      let list: Question[] = [];

      if (subject === "Combined") {
        const readingLimit = Math.ceil(limit / 2);
        const mathLimit = Math.floor(limit / 2);
        let reading: Question[] | null = null;
        let math: Question[] | null = null;

        if (usesFreshPool || usesRevisitPool) {
          const mode: "fresh" | "revisit" = usesFreshPool ? "fresh" : "revisit";
          const [readingDisciplined, mathDisciplined] = await Promise.all([
            fetchDisciplinedPool({
              targetSubject: "Reading",
              targetSubskill: null,
              targetLimit: readingLimit,
              mode,
            }),
            fetchDisciplinedPool({
              targetSubject: "Math",
              targetSubskill: null,
              targetLimit: mathLimit,
              mode,
            }),
          ]);

          if (readingDisciplined && mathDisciplined) {
            reading = readingDisciplined;
            math = mathDisciplined;
          }
        }

        if (!reading || !math) {
          const [readingRaw, mathRaw] = await Promise.all([
            fetchQuestions({
              targetSubject: "Reading",
              targetSubskill: null,
              targetLimit: fallbackFetchLimit,
            }),
            fetchQuestions({
              targetSubject: "Math",
              targetSubskill: null,
              targetLimit: fallbackFetchLimit,
            }),
          ]);

          reading = readingRaw;
          math = mathRaw;

          if (usesFreshPool) {
            const [seenReading, seenMath] = await Promise.all([
              fetchSeenQuestionIds("Reading"),
              fetchSeenQuestionIds("Math"),
            ]);

            if (seenReading) {
              reading = reading.filter((question) => !seenReading.has(question.id));
            }
            if (seenMath) {
              math = math.filter((question) => !seenMath.has(question.id));
            }
          } else if (usesRevisitPool) {
            const [seenReading, seenMath] = await Promise.all([
              fetchSeenQuestionIds("Reading"),
              fetchSeenQuestionIds("Math"),
            ]);

            if (seenReading?.size) {
              const seenFirst = reading.filter((question) => seenReading.has(question.id));
              const unseenRest = reading.filter((question) => !seenReading.has(question.id));
              reading = [...seenFirst, ...unseenRest];
            }
            if (seenMath?.size) {
              const seenFirst = math.filter((question) => seenMath.has(question.id));
              const unseenRest = math.filter((question) => !seenMath.has(question.id));
              math = [...seenFirst, ...unseenRest];
            }
          }
        }

        const mixed: Question[] = [];
        const maxLen = Math.max(reading.length, math.length);
        for (let i = 0; i < maxLen; i += 1) {
          if (reading[i]) mixed.push(reading[i]);
          if (math[i]) mixed.push(math[i]);
        }
        list = mixed.slice(0, limit);
      } else {
        let nextList: Question[] | null = null;
        const targetSubskillKeys = subskillCandidates(subskill);
        const targetSubskills = targetSubskillKeys.length ? targetSubskillKeys : [null];

        if (usesFreshPool || usesRevisitPool) {
          for (const targetSubskill of targetSubskills) {
            const candidate = await fetchDisciplinedPool({
              targetSubject: subject,
              targetSubskill,
              targetLimit: limit,
              mode: usesFreshPool ? "fresh" : "revisit",
            });
            if (candidate && candidate.length > 0) {
              nextList = candidate;
              break;
            }
            if (!nextList) nextList = candidate;
          }
        }

        if (!nextList) {
          let base: Question[] = [];
          for (const targetSubskill of targetSubskills) {
            const candidate = await fetchQuestions({
              targetSubject: subject,
              targetSubskill,
              targetLimit: fallbackFetchLimit,
            });
            if (candidate.length > 0) {
              base = candidate;
              break;
            }
            if (!base.length) base = candidate;
          }
          let filtered = base;

          if (usesFreshPool) {
            const seen = await fetchSeenQuestionIds(subject);
            if (seen) {
              filtered = base.filter((question) => !seen.has(question.id));
            }
          } else if (usesRevisitPool) {
            const seen = await fetchSeenQuestionIds(subject);
            if (seen?.size) {
              const seenFirst = base.filter((question) => seen.has(question.id));
              const unseenRest = base.filter((question) => !seen.has(question.id));
              filtered = [...seenFirst, ...unseenRest];
            }
          }

          nextList = filtered.slice(0, limit);
        }

        list = nextList.slice(0, limit);
      }

      if (!list.length && usesFreshPool) {
        throw new Error(
          "No fresh questions are currently available for this filter. Use Review or switch to explicit revisit."
        );
      }
      if (!list.length && usesRevisitPool) {
        throw new Error(
          "No revisit questions are available for this filter yet. Run fresh mode or clear your review queue first."
        );
      }
      if (!list.length) throw new Error("No questions returned for this filter.");
      if (usesFreshPool && list.length < limit) {
        setPoolNotice(
          `Only ${list.length} fresh question${list.length === 1 ? "" : "s"} available right now for this filter.`
        );
      } else if (usesRevisitPool && list.length < limit) {
        setPoolNotice(
          `Only ${list.length} revisit question${list.length === 1 ? "" : "s"} available right now for this filter.`
        );
      }

      setQuestions(list);
      setIdx(0);
      setAnswers({});
      setMomentum(createMomentum(list.length || limit));
      setSessionPayoff(null);
      setSessionClientId(createClientSessionId());
      setHistorySessionId(null);
      setFinalAnalysis(null);
      setSessionDebtBefore(null);
      setPostSessionDueCount(null);
      setPostSessionMasteryProbe(null);
      setPostSessionSignalsNotice(null);
      setToolsOpen(false);
      setExamToolsUi({
        calculatorOpen: false,
        calculatorMinimized: false,
        referenceOpen: false,
        desktopRect: DEFAULT_EXAM_CALCULATOR_RECT,
      });
      setDesmosSessionState(null);
      setEliminatedOptionsByQuestion({});
      setExamDraftAnswers({});
      setExamMarked({});
      setExamNavFilter("all");
      setExamSubmitPanelOpen(false);
      setExamNavigatorOpen(false);
      setExamOptionEliminatorMode(false);
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
  }, [subject, subskill, includeSeen]);

  function switchSubject(nextSubject: "Reading" | "Math" | "Combined") {
    const params = new URLSearchParams(sp.toString());
    params.set("subject", nextSubject);
    params.delete("subskill");
    router.push(`/practice?${params.toString()}`);
  }

  function switchPoolMode(nextIncludeSeen: boolean) {
    const params = new URLSearchParams(sp.toString());
    if (nextIncludeSeen) {
      params.set("revisit", "1");
    } else {
      params.delete("revisit");
    }
    router.replace(`/practice?${params.toString()}`);
  }

  function switchAttackPath(nextAttack: StartAttackId) {
    if (nextAttack === "exam_block" && !tier.limits.examMode) {
      router.push("/pricing");
      return;
    }

    const params = new URLSearchParams(sp.toString());

    if (nextAttack === "fresh_signal") {
      setPracticeMode("trainer");
      params.set("mode", "trainer");
      params.delete("subskill");
      params.delete("revisit");
      router.push(`/practice?${params.toString()}`);
      return;
    }

    if (nextAttack === "timed_block") {
      setPracticeMode("timed");
      params.set("mode", "timed");
      params.delete("subskill");
      params.delete("revisit");
      router.push(`/practice?${params.toString()}`);
      return;
    }

    if (nextAttack === "exam_block") {
      setPracticeMode("exam");
      params.set("mode", "exam");
      params.delete("subskill");
      params.delete("revisit");
      router.push(`/practice?${params.toString()}`);
      return;
    }

    if (nextAttack === "revisit") {
      setPracticeMode("trainer");
      params.set("mode", "trainer");
      params.delete("subskill");
      params.set("revisit", "1");
      router.push(`/practice?${params.toString()}`);
      return;
    }

    const weakest = studentState?.weakestSkill;
    setPracticeMode("trainer");
    params.set("mode", "trainer");
    params.delete("revisit");
    if (weakest) {
      params.set("subject", weakest.subject);
      params.set("subskill", weakest.subskill);
    } else {
      params.delete("subskill");
    }

    router.push(`/practice?${params.toString()}`);
  }

  function startSession() {
    setMode("in_session");
    setIdx(0);
    setAnswers({});
    setMomentum(createMomentum(questions.length || limit));
    setSessionPayoff(null);
    setSessionClientId(createClientSessionId());
    setHistorySessionId(null);
    setBaselineLastSession(identity?.lastSession ?? null);
    setFinalAnalysis(null);
    setSessionDebtBefore(studentState?.reviewDebt.dueCount ?? null);
    setPostSessionDueCount(null);
    setPostSessionMasteryProbe(null);
    setPostSessionSignalsNotice(null);
    setToolsOpen(false);
    setExamToolsUi({
      calculatorOpen: false,
      calculatorMinimized: false,
      referenceOpen: false,
      desktopRect: DEFAULT_EXAM_CALCULATOR_RECT,
    });
    setDesmosSessionState(null);
    setEliminatedOptionsByQuestion({});
    setExamDraftAnswers({});
    setExamMarked({});
    setExamNavFilter("all");
    setExamSubmitPanelOpen(false);
    setExamNavigatorOpen(false);
    setExamOptionEliminatorMode(false);
    setExamStartedAtMs(Date.now());
    resetQuestionUI();
    resetTimingState();
  }

  const hydratePostSessionSignals = useCallback(async (args: {
    source: Record<string, AnswerInsert>;
    sourceAnalysis: SessionAnalysis;
  }) => {
    setPostSessionSignalsNotice(null);
    setPostSessionDueCount(null);
    setPostSessionMasteryProbe(null);

    const supabase = getSupabase();

    try {
      const countRes = await supabase.rpc("get_due_review_count", { p_scan: 2000 });
      if (countRes.error) {
        if (isMissingRpc(countRes.error, "get_due_review_count")) {
          const dueRes = await supabase.rpc("get_due_review_questions", { p_limit: 240 });
          if (dueRes.error) throw new Error(dueRes.error.message);
          setPostSessionDueCount(((dueRes.data ?? []) as Array<{ id: string }>).length);
        } else {
          throw new Error(countRes.error.message);
        }
      } else {
        setPostSessionDueCount(Math.max(0, Number(countRes.data ?? 0)));
      }
    } catch (e: unknown) {
      setPostSessionDueCount(null);
      setPostSessionSignalsNotice(errorMessage(e, "Post-session due queue snapshot is unavailable."));
    }

    const probeTopic = args.sourceAnalysis.primaryRepairTarget?.topic || subskill || null;
    if (!probeTopic) return;

    const probeSubjectFromAnswers = Object.values(args.source).find(
      (answer) => (answer.topic?.trim() || "Unknown") === probeTopic
    )?.subject;

    const subjectCandidates: Array<"Reading" | "Math"> =
      probeSubjectFromAnswers === "Reading" || probeSubjectFromAnswers === "Math"
        ? [probeSubjectFromAnswers]
        : subject === "Reading"
        ? ["Reading"]
        : subject === "Math"
        ? ["Math"]
        : ["Reading", "Math"];

    type MasteryRow = { subskill: string; attempts: number; accuracy: number | null };
    try {
      let matched: MasteryRow | null = null;
      let matchedSubject: "Reading" | "Math" = subjectCandidates[0] || "Reading";

      for (const candidateSubject of subjectCandidates) {
        const res = await supabase.rpc("get_skill_mastery", { p_subject: candidateSubject });
        if (res.error) throw new Error(res.error.message);

        const rows = (res.data ?? []) as MasteryRow[];
        const hit = rows.find(
          (row) => row.subskill.trim().toLowerCase() === probeTopic.trim().toLowerCase()
        );
        if (hit) {
          matched = hit;
          matchedSubject = candidateSubject;
          break;
        }
      }

      if (!matched) return;
      const attempts = Math.max(0, Math.round(matched.attempts || 0));
      const accuracy = Math.max(0, Math.min(1, Number(matched.accuracy ?? 0)));

      setPostSessionMasteryProbe({
        subject: matchedSubject,
        topic: matched.subskill,
        attempts,
        accuracyPct: Math.round(accuracy * 100),
        mastery: masteryFor({ attempts, accuracy }),
        movement: movementFor({ attempts, accuracy }),
      });
    } catch (e: unknown) {
      setPostSessionMasteryProbe(null);
      setPostSessionSignalsNotice((prev) => prev || errorMessage(e, "Mastery movement probe is unavailable."));
    }
  }, [subject, subskill]);

  const finishSession = useCallback(async (finalAnswers?: Record<string, AnswerInsert>) => {
    const source = finalAnswers ?? answers;
    const answered = Object.keys(source).length;
    const correct = Object.values(source).filter((answer) => answer.is_correct).length;
    const sourceAnalysis = analyzeReviewSession(
      Object.entries(source).map(([questionId, value]) => ({
        questionId,
        subject: value.subject,
        topic: value.topic,
        correct: value.is_correct,
      }))
    );
    setFinalAnalysis(sourceAnalysis);

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
        outcome: sourceAnalysis.outcome,
        scoreBandLow: scoreBand.low,
        scoreBandHigh: scoreBand.high,
        topics: buildTopicSnapshots(
          Object.values(source).map((answer) => ({
            subject: answer.subject,
            topic: answer.topic,
            correct: answer.is_correct,
          }))
        ),
        questions: questions
          .map((question, position) => {
            const answer = source[question.id];
            if (!answer) return null;
            return {
              questionId: question.id,
              position: position + 1,
              subject: answer.subject || question.subject || null,
              topic: answer.topic ?? question.topic ?? null,
              questionText: question.question_text,
              optionA: question.option_a,
              optionB: question.option_b,
              optionC: question.option_c,
              optionD: question.option_d,
              correctOption: String(question.correct_option || "").toUpperCase(),
              selectedOption: String(answer.selected_option || "").toUpperCase(),
              isCorrect: !!answer.is_correct,
              isReview: false,
              timeTakenSeconds: Math.max(0, Math.round(answer.time_taken_seconds || 0)),
              explanation: question.explanation ?? null,
            };
          })
          .filter((item): item is NonNullable<typeof item> => !!item),
      });
      setHistorySessionId(history.sessionId);
      await hydratePostSessionSignals({ source, sourceAnalysis });
    } catch (e: unknown) {
      setSessionPayoff(null);
      setEngagementNotice(errorMessage(e, "Session results saved, but durable engagement sync failed."));
    }

    setMode("done");
    setToolsOpen(false);
    setExamToolsUi((prev) => ({
      ...prev,
      calculatorOpen: false,
      calculatorMinimized: false,
      referenceOpen: false,
    }));
    void refreshStudentState();
  }, [answers, sessionClientId, total, practiceMode, subject, subskill, examStartedAtMs, scoreBand.low, scoreBand.high, hydratePostSessionSignals, questions, refreshStudentState]);

  const finalizeExamSession = useCallback(async (args?: { forceAutoFill?: boolean }) => {
    if (!questions.length || saving) return;
    setSaving(true);
    setErr(null);
    setExamSubmitPanelOpen(false);

    try {
      const working = { ...examDraftAnswers };
      const unanswered = questions.filter((question) => !working[question.id]);
      if (unanswered.length > 0 && args?.forceAutoFill) {
        for (const question of unanswered) {
          working[question.id] = autoOptionForQuestion(question.id);
        }
        setTimingNotice(`Exam submitted with ${unanswered.length} auto-filled unanswered question(s).`);
      } else if (unanswered.length > 0) {
        setErr(`You still have ${unanswered.length} unanswered question(s). Finish them before final submission.`);
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

  const jumpToFirstUnansweredExamQuestion = useCallback(() => {
    const nextIdx = questions.findIndex((question) => !examDraftAnswers[question.id]);
    if (nextIdx >= 0) {
      jumpToQuestion(nextIdx);
      return true;
    }
    return false;
  }, [questions, examDraftAnswers, jumpToQuestion]);

  const jumpToFirstMarkedExamQuestion = useCallback(() => {
    const nextIdx = questions.findIndex((question) => !!examMarked[question.id]);
    if (nextIdx >= 0) {
      jumpToQuestion(nextIdx);
      return true;
    }
    return false;
  }, [questions, examMarked, jumpToQuestion]);

  const jumpToPreviousQuestion = useCallback(() => {
    if (idx <= 0) return;
    jumpToQuestion(idx - 1);
  }, [idx, jumpToQuestion]);

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
      setExamSubmitPanelOpen(false);
      if (args?.forceFinish) {
        await finalizeExamSession({ forceAutoFill: true });
        return;
      }
      const isLast = idx >= questions.length - 1;
      if (isLast) {
        setExamSubmitPanelOpen(true);
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

  useEffect(() => {
    if (mode !== "in_session") return;
    if (practiceMode !== "exam") return;

    const letterForDigit = (digit: string): OptionLetter | null => {
      if (digit === "1") return "A";
      if (digit === "2") return "B";
      if (digit === "3") return "C";
      if (digit === "4") return "D";
      return null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (saving) return;
      if (!q) return;

      const key = event.key;
      const lower = key.toLowerCase();
      const isWinCtrlAlt = event.ctrlKey && event.altKey && !event.metaKey;
      const isMacCmdOpt = event.metaKey && event.altKey && !event.ctrlKey;
      const isMacCmdCtrl = event.metaKey && event.ctrlKey && !event.altKey;

      // Mark for Review: Windows Ctrl+Alt+V, Mac Cmd+Shift+V.
      if (
        (isWinCtrlAlt && lower === "v") ||
        (event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey && lower === "v")
      ) {
        event.preventDefault();
        toggleExamMarkCurrent();
        return;
      }

      // Calculator: Windows Ctrl+Alt+C, Mac Cmd+Opt+C.
      if ((isWinCtrlAlt && lower === "c") || (isMacCmdOpt && lower === "c")) {
        event.preventDefault();
        if (hasMathTools) openToolSurface();
        return;
      }

      // Reference: Windows Ctrl+Alt+R, Mac Cmd+Opt+R.
      if ((isWinCtrlAlt && lower === "r") || (isMacCmdOpt && lower === "r")) {
        event.preventDefault();
        toggleExamReference();
        return;
      }

      // Option Eliminator Mode: Windows Ctrl+Alt+O, Mac Cmd+Ctrl+O.
      if ((isWinCtrlAlt && lower === "o") || (isMacCmdCtrl && lower === "o")) {
        event.preventDefault();
        setExamOptionEliminatorMode((prev) => !prev);
        return;
      }

      // Select/Deselect choices: Windows Ctrl+Shift+1..4, Mac Cmd+Ctrl+1..4.
      const selectChord =
        (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) ||
        (event.metaKey && event.ctrlKey && !event.altKey && !event.shiftKey);
      if (selectChord) {
        const letter = letterForDigit(key);
        if (letter) {
          event.preventDefault();
          if (examOptionEliminatorMode) {
            toggleOptionElimination(letter);
          } else {
            toggleExamDraftSelection(letter);
          }
          return;
        }
      }

      // Eliminate choices: Windows Ctrl+Alt+1..4, Mac Cmd+Opt+1..4.
      if (isWinCtrlAlt || isMacCmdOpt) {
        const letter = letterForDigit(key);
        if (letter) {
          event.preventDefault();
          toggleOptionElimination(letter);
          return;
        }
      }

      // Nav: Windows Ctrl+Alt+B/X, Mac Cmd+Ctrl+B/X.
      if ((isWinCtrlAlt && lower === "b") || (isMacCmdCtrl && lower === "b")) {
        event.preventDefault();
        jumpToPreviousQuestion();
        return;
      }
      if ((isWinCtrlAlt && lower === "x") || (isMacCmdCtrl && lower === "x")) {
        event.preventDefault();
        if (idx < questions.length - 1) {
          jumpToQuestion(idx + 1);
        }
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    examOptionEliminatorMode,
    hasMathTools,
    idx,
    jumpToPreviousQuestion,
    jumpToQuestion,
    mode,
    openToolSurface,
    practiceMode,
    q,
    questions.length,
    saving,
    toggleExamReference,
    toggleOptionElimination,
    toggleExamMarkCurrent,
    toggleExamDraftSelection,
  ]);

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

  const subjectSummary =
    subject === "Combined"
      ? "Reading + Math mixed"
      : subskill
      ? `${subject} targeted run`
      : `${subject} focus`;

  const modeIdentity = useMemo<ModeIdentity>(() => {
    if (practiceMode === "exam") {
      return {
        label: "Full Practice Test",
        launchNote: "Exam-style block with section navigation and delayed feedback.",
        finishPayoff: "Shows performance under realistic time pressure and highlights weak topics to review.",
      };
    }

    if (practiceMode === "timed") {
      return {
        label: "Timed Set",
        launchNote: "Per-question timing to test execution under pace.",
        finishPayoff: "Shows whether your skill stays stable under time pressure.",
      };
    }

    if (subskill) {
      return {
        label: "Weak Skill Practice",
        launchNote: "Target one specific weak area and close the gap.",
        finishPayoff: "Creates clear evidence on whether that weak area is improving.",
      };
    }

    if (includeSeen) {
      return {
        label: "Revisit",
        launchNote: "Replay seen items intentionally to stabilize patterns before new volume.",
        finishPayoff: "Confirms whether previous mistakes are actually fixed.",
      };
    }

    return {
      label: "Quick Practice",
      launchNote: "Start with fresh questions to find what needs attention now.",
      finishPayoff: "Creates clean evidence for Today, Review, Skills, and Coach.",
    };
  }, [includeSeen, practiceMode, subskill]);

  const poolModeLabel = subskill
    ? includeSeen
      ? "Targeted revisit"
      : "Targeted fresh"
    : includeSeen
    ? "Explicit revisit"
    : "Fresh pool";

  const modeLabel =
    practiceMode === "trainer" ? "Quick Practice" : practiceMode === "timed" ? "Timed Set" : "Full Practice Test";

  const modePill =
    practiceMode === "timed"
      ? `Q ${formatClock(questionSecondsLeft ?? 0)}`
      : practiceMode === "exam"
      ? `Exam ${formatClock(examSecondsLeft ?? 0)}`
      : `Accuracy ${accuracyPct}%`;

  const modePillTone: "neutral" | "accent" | "danger" =
    practiceMode === "exam" && examSecondsLeft !== null && examSecondsLeft <= 90
      ? "danger"
      : practiceMode === "trainer"
      ? "neutral"
      : "accent";

  const estimateBlockMinutesForMode = useCallback((candidateMode: PracticeMode) => {
    if (!questions.length) return 0;
    if (candidateMode === "exam") return Math.max(1, Math.round(examTimeLimitSeconds(questions) / 60));
    if (candidateMode === "timed") {
      const baseSubject = subject === "Combined" ? "Combined" : subject;
      return Math.max(1, Math.round((questionTimeLimitSeconds(baseSubject) * questions.length) / 60));
    }
    return Math.max(1, Math.round((questions.length * 78) / 60));
  }, [questions, subject]);

  const startAttackId = useMemo<StartAttackId>(() => {
    if (subskill) return "focused_drill";
    if (includeSeen) return "revisit";
    if (practiceMode === "exam") return "exam_block";
    if (practiceMode === "timed") return "timed_block";
    return "fresh_signal";
  }, [includeSeen, practiceMode, subskill]);

  const startAttack = useMemo<StartAttackDescriptor>(() => {
    const weakest = studentState?.weakestSkill;
    const shortReason =
      studentState?.recommendedAction.reason?.split(". ")[0]?.trim() || "";

    if (startAttackId === "focused_drill") {
      return {
        id: "focused_drill",
        label: "Focused Drill",
        mode: "trainer",
        needsRevisitPool: false,
        requiresSubskill: true,
        whyNow: subskill
          ? `${subject} ${subskill} is explicitly targeted right now${includeSeen ? " in revisit mode." : " in fresh mode."}`
          : weakest
          ? `Weakest active skill is ${weakest.subskill} at ${weakest.accuracyPct}% over ${weakest.attempts} attempts.`
          : "A single topic needs direct repair before adding more range.",
        payoff: "Converts one weak topic into measurable improvement fast.",
      };
    }

    if (startAttackId === "revisit") {
      return {
        id: "revisit",
        label: "Revisit",
        mode: "trainer",
        needsRevisitPool: true,
        requiresSubskill: false,
        whyNow: "Revisit confirms whether prior misses are truly fixed before new volume.",
        payoff: "Locks retention and reduces repeat mistakes.",
      };
    }

    if (startAttackId === "timed_block") {
      return {
        id: "timed_block",
        label: "Timed Block",
        mode: "timed",
        needsRevisitPool: false,
        requiresSubskill: false,
        whyNow: shortReason || "You need pacing evidence under pressure, not just untimed accuracy.",
        payoff: "Reveals timing leaks and stability under pace.",
      };
    }

    if (startAttackId === "exam_block") {
      return {
        id: "exam_block",
        label: "Exam Block",
        mode: "exam",
        needsRevisitPool: false,
        requiresSubskill: false,
        whyNow: "Best for full-run readiness with strict SAT-style execution constraints.",
        payoff: "Gives full-pressure readiness signal and weak-zone exposure.",
      };
    }

    return {
      id: "fresh_signal",
      label: "Fresh Signal",
      mode: "trainer",
      needsRevisitPool: false,
      requiresSubskill: false,
      whyNow: shortReason || "Fresh unseen questions are the cleanest way to surface your next weak area.",
      payoff: "Creates clean evidence for your next decision.",
    };
  }, [includeSeen, startAttackId, studentState?.weakestSkill, studentState?.recommendedAction.reason, subskill, subject]);

  const startAttackTarget = useMemo(() => {
    if (subskill) return `${subject} • ${subskill}`;
    if (studentState?.weakestSkill && startAttack.id === "focused_drill") {
      return `${studentState.weakestSkill.subject} • ${studentState.weakestSkill.subskill}`;
    }
    if (subject === "Combined") return "Reading + Math";
    return subject;
  }, [startAttack.id, studentState?.weakestSkill, subskill, subject]);

  const startAttackRecommendedMinutes = useMemo(() => {
    return estimateBlockMinutesForMode(startAttack.mode);
  }, [estimateBlockMinutesForMode, startAttack.mode]);

  const startAttackIsActive =
    (startAttack.id === "focused_drill" && !!subskill) ||
    (startAttack.id === "revisit" && includeSeen && !subskill) ||
    (startAttack.id === "timed_block" && practiceMode === "timed" && !subskill && !includeSeen) ||
    (startAttack.id === "exam_block" && practiceMode === "exam" && !subskill && !includeSeen) ||
    (startAttack.id === "fresh_signal" && practiceMode === "trainer" && !subskill && !includeSeen);

  const momentumStateLabel = useMemo(() => {
    if (momentum.energy >= 82) return "Locked momentum";
    if (momentum.energy >= 62) return "Stable momentum";
    if (momentum.energy >= 40) return "Recovering momentum";
    return "Low momentum";
  }, [momentum.energy]);

  const examSections = useMemo(() => {
    if (practiceMode !== "exam" || !questions.length) return [];
    const grouped = new Map<string, { label: string; firstIdx: number; count: number; answered: number; marked: number }>();

    questions.forEach((question, qIdx) => {
      const label = question.subject === "Math" ? "Math section" : "Reading section";
      if (!grouped.has(label)) {
        grouped.set(label, { label, firstIdx: qIdx, count: 0, answered: 0, marked: 0 });
      }
      const row = grouped.get(label)!;
      row.count += 1;
      if (examDraftAnswers[question.id]) row.answered += 1;
      if (examMarked[question.id]) row.marked += 1;
    });

    return [...grouped.values()];
  }, [practiceMode, questions, examDraftAnswers, examMarked]);

  const compactExamShell = practiceMode === "exam" && !examNavigatorOpen && !examSubmitPanelOpen;

  return (
    <main className="min-h-screen">
      <StudyFeedbackFX
        active={mode === "done"}
        variant={analysis.outcome === "advance" ? "complete" : "recovery"}
        intensity={analysis.outcome === "advance" ? "standard" : "subtle"}
      />
      <StudyFeedbackFX
        active={mode === "in_session" && practiceMode !== "exam" && !!feedback?.correct}
        variant="correct"
        intensity="subtle"
      />
      <PageHeader
        label="Practice"
        title="Practice"
        subtitle={`${subjectSummary} • ${modeIdentity.launchNote}`}
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
          note="Start fast. Finish the set. Review mistakes before moving on."
        />
      )}

      {loading && (
        <Card title="Loading practice" subtitle="Preparing your session">
          <div className="space-y-2">
            <div className="state-skeleton h-3 w-2/3" />
            <div className="state-skeleton h-3 w-1/2" />
            <div className="state-skeleton h-24 w-full" />
          </div>
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
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Recommended attack
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{startAttack.label}</h2>
                <p className="mt-2 text-sm text-[#d2dbec]">Why now: {startAttack.whyNow}</p>
                <div className="mt-2 text-xs text-[#c8d4ed]">Expected payoff: {startAttack.payoff}</div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Subject: <span className="font-semibold text-white">{subject}</span>
                  </div>
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Target: <span className="font-semibold text-white">{startAttackTarget}</span>
                  </div>
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Run time: <span className="font-semibold text-white">{startAttackRecommendedMinutes}m</span>
                  </div>
                  <div className="rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                    Question pack: <span className="font-semibold text-white">{questions.length}</span>
                  </div>
                </div>

                <div className="mt-5 max-w-sm">
                  <button
                    onClick={startSession}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0f1b33] transition hover:bg-[#ecf3ff]"
                  >
                    {startAttackIsActive ? "Start attack" : "Start current selection"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#bdd5ff]">Other attack paths</div>
                  <div className="mt-2 grid gap-2">
                    {([
                      { id: "fresh_signal", label: "Fresh Signal", note: "Unseen questions for the next weak signal." },
                      { id: "focused_drill", label: "Focused Drill", note: "One subskill, immediate repair." },
                      { id: "timed_block", label: "Timed Block", note: "Pace pressure signal." },
                      { id: "exam_block", label: "Exam Block", note: "Strict SAT block." },
                      { id: "revisit", label: "Revisit", note: "Replay to confirm fixes." },
                    ] as const).map((attack) => {
                      const active = startAttack.id === attack.id;
                      const locked = attack.id === "exam_block" && !tier.limits.examMode;

                      return (
                        <button
                          key={attack.id}
                          onClick={() => switchAttackPath(attack.id)}
                          disabled={locked}
                          className={[
                            "rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed",
                            active
                              ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33]"
                              : locked
                              ? "border-[#4a5a7a] bg-white/5 text-[#8fa2c4] opacity-70"
                              : "border-[#4b628f] bg-white/10 text-[#d8e4fb] hover:bg-white/15",
                          ].join(" ")}
                        >
                          <div className="text-xs font-semibold">
                            {attack.label}
                            {locked && <span className="ml-1 text-[10px] uppercase tracking-[0.12em]">Pro+</span>}
                          </div>
                          <div className={`mt-1 text-[11px] ${active ? "text-[#23375d]" : "text-[#cfdbf3]"}`}>{attack.note}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-5 sm:px-6">
              <PracticeAttackCompanion
                modeLabel={startAttack.label}
                targetLabel={startAttackTarget}
                minutes={startAttackRecommendedMinutes}
                questionCount={questions.length}
                reviewDue={studentState?.reviewDebt.dueCount ?? 0}
              />
            </div>

            <div className="border-t border-white/10 bg-black/10 p-4 sm:px-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Secondary controls</div>
              <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["Reading", "Math", "Combined"] as const).map((option) => {
                    const active = subject === option;
                    return (
                      <button
                        key={option}
                        onClick={() => switchSubject(option)}
                        className={[
                          "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                          active
                            ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33]"
                            : "border-[#4b628f] bg-white/10 text-[#d8e4fb] hover:bg-white/15",
                        ].join(" ")}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {!subskill ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => switchPoolMode(false)}
                      className={[
                        "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                        !includeSeen
                          ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33]"
                          : "border-[#4b628f] bg-white/10 text-[#d8e4fb] hover:bg-white/15",
                      ].join(" ")}
                    >
                      Fresh pool
                    </button>
                    <button
                      onClick={() => switchPoolMode(true)}
                      className={[
                        "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                        includeSeen
                          ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33]"
                          : "border-[#4b628f] bg-white/10 text-[#d8e4fb] hover:bg-white/15",
                      ].join(" ")}
                    >
                      Revisit pool
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#4b628f] bg-white/10 px-3 py-2 text-xs text-[#d8e4fb]">
                    Subskill lock: {subskill}
                  </div>
                )}
              </div>

              {planNotice && (
                <div className="mt-3 rounded-xl border border-[#5872a7] bg-white/10 px-3 py-3 text-xs text-[#d6e3fb]">
                  {planNotice}
                </div>
              )}
              {poolNotice && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  {poolNotice}
                </div>
              )}

              {(subject === "Math" || subject === "Combined") && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3f557f] bg-white/5 px-3 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">SAT tool layer</div>
                    <div className="mt-1 text-xs text-[#c8d4ed]">Formula and calculator strategy available in-session.</div>
                  </div>
                  <button
                    onClick={openToolSurface}
                    className="rounded-lg border border-[#4f6693] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb]"
                  >
                    Open Bluebook tools
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {!loading && !err && mode === "in_session" && q && (
        <div className="grid gap-5">
          <div
            className={[
              "sticky top-[4rem] z-20 overflow-hidden rounded-2xl border border-[#22345e] bg-[linear-gradient(145deg,#0f172a,#111d35)] shadow-xl backdrop-blur",
              compactExamShell ? "p-3 sm:p-3.5" : "p-4",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">
                {subject === "Combined" ? `${q.subject} live` : modeLabel} • Question {Math.min(idx + 1, total)} / {total}
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill text={modePill} tone={modePillTone} />
                <Pill text={poolModeLabel} tone={includeSeen || subskill ? "accent" : "neutral"} />
                <Pill text={`Combo ${momentum.combo}`} tone={momentum.currentStreak >= 4 ? "success" : "neutral"} />
                {practiceMode === "exam" && (
                  <Pill text={examOptionEliminatorMode ? "Eliminator ON" : "Eliminator OFF"} tone={examOptionEliminatorMode ? "accent" : "neutral"} />
                )}
                {hasMathTools && (
                  <button
                    onClick={openToolSurface}
                    className="rounded-full border border-[#4f6795] bg-white/10 px-3 py-1 text-xs font-semibold text-[#d7e3fb] transition hover:bg-white/20"
                  >
                    Bluebook tools
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
            <div className={`mt-2 grid gap-2 text-xs text-[#c8d4ed] ${practiceMode === "exam" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
              <div>Answered {practiceMode === "exam" ? examAnsweredCount : answeredCount}</div>
              <div>Correct {correctCount}</div>
              <div>Accuracy {accuracyPct}%</div>
              <div className={practiceMode === "exam" ? "" : "sm:text-right"}>Progress {momentum.progressPct}%</div>
              {practiceMode === "exam" && <div>Unanswered {examUnansweredCount}</div>}
            </div>
            {practiceMode !== "exam" && <div className="mt-2 text-xs text-[#9db0d2]">{momentumStateLabel}</div>}
            {practiceMode === "exam" && (
              <div className={`mt-3 grid gap-2 ${compactExamShell ? "grid-cols-2" : "sm:grid-cols-3"}`}>
                <div className={`rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-xs text-[#cedaf1] ${compactExamShell ? "col-span-2 sm:col-span-1" : ""}`}>
                  Marked <span className="font-semibold text-white">{examMarkedCount}</span>
                  <span className="mx-2 text-white/25">•</span>
                  Unanswered <span className="font-semibold text-white">{examUnansweredCount}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExamNavigatorOpen((prev) => !prev)}
                    className="rounded-lg border border-[#4f6795] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb]"
                  >
                    {examNavigatorOpen ? "Hide map" : "Question map"}
                  </button>
                  <button
                    onClick={() => setExamSubmitPanelOpen(true)}
                    disabled={saving}
                    className="rounded-lg border border-[#4f6795] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb] disabled:opacity-60"
                  >
                    Review & submit
                  </button>
                </div>
              </div>
            )}
            {practiceMode === "exam" && hasMathTools && (
              <div className="mt-3">
                <TestingToolsDock
                  calculatorOpen={examToolsUi.calculatorOpen}
                  calculatorMinimized={examToolsUi.calculatorMinimized}
                  referenceOpen={examToolsUi.referenceOpen}
                  onOpenCalculator={openToolSurface}
                  onMinimizeCalculator={minimizeExamCalculator}
                  onCloseCalculator={closeExamCalculator}
                  onToggleReference={toggleExamReference}
                />
              </div>
            )}
            {practiceMode === "exam" && examSections.length > 1 && !compactExamShell && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {examSections.map((section) => (
                  <button
                    key={section.label}
                    onClick={() => jumpToQuestion(section.firstIdx)}
                    className="rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-left text-xs text-[#cfe0ff] hover:bg-white/10"
                  >
                    <div className="font-semibold text-white">{section.label}</div>
                    <div className="mt-1 text-[#c4d5f3]">
                      {section.answered}/{section.count} answered • {section.marked} marked
                    </div>
                  </button>
                ))}
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
                <button
                  onClick={() => setExamOptionEliminatorMode((prev) => !prev)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    examOptionEliminatorMode
                      ? "border-[#1a2f58] bg-[#edf5ff] text-[#0f1b33]"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {examOptionEliminatorMode ? "Eliminator ON" : "Eliminator OFF"}
                </button>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const chosen = selected === letter;
                const correct = locked && feedback && feedback.correct && q.correct_option.toUpperCase() === letter;
                const wrongChosen = locked && chosen && feedback && !feedback.correct;
                const eliminated = !!eliminatedOptionsByQuestion[q.id]?.[letter];

                let cls = "border border-gray-200 bg-white shadow-sm";
                if (chosen) cls = "border-[#0f1b33] bg-[#edf5ff] shadow-md";
                if (correct) cls = "border-[#2a9b67] bg-[#edfcf3] shadow-md";
                if (wrongChosen) cls = "border-[#d54768] bg-[#fff2f5] shadow-md";
                if (eliminated) cls = `${cls} opacity-60`;

                return (
                  <div key={letter} className={`relative w-full rounded-2xl transition ${cls}`}>
                    <button
                      onClick={() => pick(letter)}
                      className="w-full rounded-2xl p-4 pr-28 text-left"
                      disabled={saving || (practiceMode !== "exam" && locked)}
                    >
                      <div className="mb-1 text-xs font-semibold text-gray-500">{letter}</div>
                      <div className={`text-sm text-gray-900 ${eliminated ? "line-through" : ""}`}>
                        {optionText(letter)}
                      </div>
                    </button>
                    <button
                      onClick={() => toggleOptionElimination(letter)}
                      className={[
                        "absolute right-3 top-3 rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                        eliminated
                          ? "border-[#8f9ab2] bg-[#f2f5fa] text-[#425269]"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400",
                      ].join(" ")}
                      disabled={saving}
                    >
                      {eliminated ? "Undo X" : "Eliminate"}
                    </button>
                    {eliminated && (
                      <div
                        className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-[#7b879f]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
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
                  {idx === total - 1 ? (saving ? "Saving…" : "Save & review") : saving ? "Saving…" : "Save & next"}
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
                  <div className="mt-1 text-xs text-gray-700">Combo {momentum.combo}</div>

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
            <div className={`${examNavigatorOpen ? "block" : "hidden"} lg:block`}>
            <Card title="Question navigator" subtitle="Jump between items, revisit marked questions, then submit.">
              <div className="mb-3 flex flex-wrap gap-2">
                {([
                  { key: "all", label: `All (${total})` },
                  { key: "marked", label: `Marked (${examMarkedCount})` },
                  { key: "unanswered", label: `Unanswered (${examUnansweredCount})` },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setExamNavFilter(item.key)}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      examNavFilter === item.key
                        ? "border-[#0f1b33] bg-[#0f1b33] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
                {examVisibleQuestionIndices.map((qIdx) => {
                  const question = questions[qIdx];
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
              {examVisibleQuestionIndices.length === 0 && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  No questions match this filter.
                </div>
              )}
              <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                <div>Answered {examAnsweredCount}/{total}</div>
                <div>Marked {examMarkedCount}</div>
                <div>Unanswered {examUnansweredCount}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
                <span className="rounded-full border border-[#0f1b33] bg-[#0f1b33] px-2.5 py-1 font-semibold text-white">Current</span>
                <span className="rounded-full border border-[#6b7893] bg-[#eef3fb] px-2.5 py-1 font-semibold text-[#0f1b33]">Marked</span>
                <span className="rounded-full border border-[#9de0bb] bg-[#ebfdf2] px-2.5 py-1 font-semibold text-[#0f8a4e]">Answered</span>
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600">Unanswered</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => {
                    const jumped = jumpToFirstUnansweredExamQuestion();
                    if (jumped) setExamNavFilter("unanswered");
                    setExamNavigatorOpen(false);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Jump to first unanswered
                </button>
                <button
                  onClick={() => {
                    const jumped = jumpToFirstMarkedExamQuestion();
                    if (jumped) setExamNavFilter("marked");
                    setExamNavigatorOpen(false);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Jump to first marked
                </button>
              </div>
            </Card>
            </div>
          )}

          {practiceMode === "exam" && examSubmitPanelOpen && (
            <Card
              title="Exam submission checkpoint"
              subtitle="Run this check before final submission."
              right={<Pill text={examUnansweredCount === 0 ? "Ready" : "Incomplete"} tone={examUnansweredCount === 0 ? "success" : "danger"} />}
              accent
              prominence="prominent"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Answered: <span className="font-semibold text-black">{examAnsweredCount}/{total}</span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Marked: <span className="font-semibold text-black">{examMarkedCount}</span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Unanswered: <span className="font-semibold text-black">{examUnansweredCount}</span>
                </div>
              </div>

              {examUnansweredCount > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  Submission is locked until unanswered questions are completed.
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  onClick={() => {
                    jumpToFirstUnansweredExamQuestion();
                    setExamNavFilter("unanswered");
                    setExamSubmitPanelOpen(false);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:border-gray-400 hover:bg-gray-50"
                  disabled={examUnansweredCount === 0}
                >
                  Fix unanswered
                </button>
                <button
                  onClick={() => {
                    jumpToFirstMarkedExamQuestion();
                    setExamNavFilter("marked");
                    setExamSubmitPanelOpen(false);
                  }}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:border-gray-400 hover:bg-gray-50"
                  disabled={examMarkedCount === 0}
                >
                  Review marked
                </button>
                <button
                  onClick={() => void finalizeExamSession({ forceAutoFill: false })}
                  className="inline-flex items-center justify-center rounded-xl border border-[#0e1b34] bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2b4a] disabled:opacity-60"
                  disabled={examUnansweredCount > 0 || saving}
                >
                  {saving ? "Submitting…" : "Submit exam"}
                </button>
              </div>
            </Card>
          )}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-[rgba(248,251,255,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-3 shadow-xl backdrop-blur md:hidden">
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/90 bg-white/90 p-3">
              <div className="mb-2 text-xs font-semibold text-[#0f172a]">
                {practiceMode === "exam"
                  ? `Exam shell • ${examAnsweredCount}/${total} answered`
                  : `${modeLabel} live • ${answeredCount}/${total} answered`}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={jumpToPreviousQuestion}
                  disabled={idx <= 0 || saving}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (practiceMode === "exam") {
                      void submit();
                      return;
                    }
                    if (!locked) {
                      void submit();
                      return;
                    }
                    void nextOrFinish();
                  }}
                  disabled={
                    saving ||
                    (practiceMode === "exam" ? !selected : !locked && !selected)
                  }
                  className="rounded-lg border border-[#0e1b34] bg-[#0e1b34] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {practiceMode === "exam"
                    ? idx === total - 1
                      ? "Save & review"
                      : "Save & next"
                    : !locked
                    ? "Submit"
                    : idx === total - 1
                    ? "Finish"
                    : "Next"}
                </button>
                {practiceMode === "exam" ? (
                  <button
                    onClick={() => setExamNavigatorOpen((prev) => !prev)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                  >
                    {examNavigatorOpen ? "Hide map" : "Question map"}
                  </button>
                ) : hasMathTools ? (
                  <button
                    onClick={() => setToolsOpen(true)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                  >
                    Tools
                  </button>
                ) : (
                  <button
                    disabled
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-500 disabled:opacity-80"
                  >
                    No tools
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {!loading && !err && mode === "done" && (
        <div className="grid gap-4">
          <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
            <div className="p-5 sm:p-6">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
                  Practice result
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {sessionOutcome?.title ?? "Execution complete"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#d2dbec]">
                  {sessionOutcome?.note ?? "Choose the next route while the signal is still fresh."}
                </p>
                <div className="mt-3 rounded-xl border border-[#3f557f] bg-white/5 p-3 text-sm text-[#cedaf1]">
                  {sessionPayoff
                    ? `Payoff secured: +${sessionPayoff.totalAwarded} XP${
                        identityStatus ? ` • ${identityStatus.division.label} L${identityStatus.level}` : ""
                      }${identity ? ` • ${identity.streakDays} day streak` : ""}.`
                    : `Payoff secured: ${modeIdentity.finishPayoff}`}
                </div>
              </div>

              <div className="mt-5">
                <PracticePayoffCompanion
                  accuracy={analysis.accuracyPct}
                  delta={executionDelta?.accuracyDelta ?? null}
                  recovered={analysis.recoveredTopics.length}
                  weakRemaining={analysis.failedTopics.length}
                  reviewDue={postSessionDueCount ?? 0}
                />
              </div>
            </div>
          </section>

          <Card title="Next route" subtitle="Run the highest-value follow-up while this signal is still fresh." accent prominence="prominent">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#cfe2ff] bg-[#f7fbff] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Weak topic surfaced</div>
                {repairTopic ? (
                  <>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-[#0e1b34]">{repairTopic}</div>
                    <div className="mt-1 text-sm text-[#4d607f]">
                      {analysis.primaryRepairTarget
                        ? `${Math.round(analysis.primaryRepairTarget.accuracy * 100)}% on ${analysis.primaryRepairTarget.total} question${
                            analysis.primaryRepairTarget.total === 1 ? "" : "s"
                          } (${analysis.primaryRepairTarget.incorrect} miss${
                            analysis.primaryRepairTarget.incorrect === 1 ? "" : "es"
                          }).`
                        : "Weakness surfaced in this block."}
                    </div>
                    {postSessionMasteryProbe && (
                      <div className="mt-3 rounded-xl border border-[#d7e5fb] bg-white px-3 py-3 text-sm text-[#4d607f]">
                        Current mastery state:{" "}
                        <span className="font-semibold text-[#0f1b33]">
                          {postSessionMasteryProbe.mastery}
                        </span>
                        <span className="mx-2 text-[#9ab2da]">•</span>
                        Movement:{" "}
                        <span className="font-semibold text-[#0f1b33]">
                          {postSessionMasteryProbe.movement}
                        </span>
                        <span className="mx-2 text-[#9ab2da]">•</span>
                        {postSessionMasteryProbe.accuracyPct}% across {postSessionMasteryProbe.attempts} attempts
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-sm text-[#4d607f]">
                    No single weak topic dominated this block. Push one more clean set to reveal the next bottleneck.
                  </div>
                )}
                <div className="mt-4 grid gap-2">
                  {analysis.recoveredTopics.slice(0, 1).map((topic) => (
                    <div
                      key={`recovered-${topic.topic}`}
                      className="rounded-lg border border-[#9de0bb] bg-[#ebfdf2] px-3 py-2 text-sm text-[#0f8a4e]"
                    >
                      Recovered this block: <span className="font-semibold">{topic.topic}</span> ({Math.round(topic.accuracy * 100)}%)
                    </div>
                  ))}
                  {analysis.failedTopics.slice(0, 1).map((topic) => (
                    <div
                      key={`failed-${topic.topic}`}
                      className="rounded-lg border border-[#f5b8c4] bg-[#fff2f5] px-3 py-2 text-sm text-[#b02039]"
                    >
                      Still weak: <span className="font-semibold">{topic.topic}</span> ({Math.round(topic.accuracy * 100)}%)
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Do this now</div>
                <div className="mt-2 text-sm text-gray-700">{primaryFinishAction.note}</div>
                <div className="mt-4">
                  {primaryFinishAction.href ? (
                    <PrimaryButton href={primaryFinishAction.href}>{primaryFinishAction.label}</PrimaryButton>
                  ) : (
                    <PrimaryButton onClick={primaryFinishAction.onClick}>{primaryFinishAction.label}</PrimaryButton>
                  )}
                </div>

                {cappedSecondaryActions.length > 0 && (
                  <div className="mt-4 grid gap-3">
                    {cappedSecondaryActions.map((action) => (
                      <div key={action.id} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                        <div className="text-xs text-gray-600">{action.note}</div>
                        <div className="mt-2">
                          <SecondaryButton href={action.href}>{action.label}</SecondaryButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                  Review due now: <span className="font-semibold text-black">{postSessionDueCount ?? "—"}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  Practice signal: <span className="font-semibold text-black">{scoreBand.low}–{scoreBand.high}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  {scoreBand.confidence} confidence
                </div>
              </div>
            </div>

            {postSessionSignalsNotice && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {postSessionSignalsNotice}
              </div>
            )}

            {engagementNotice && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                {engagementNotice}
              </div>
            )}
          </Card>
        </div>
      )}

      <MathToolsLayer
        open={toolsOpen && hasMathTools && toolProfile === "learning"}
        onClose={() => setToolsOpen(false)}
        topicHint={toolsTopicHint}
        modeLabel={modeLabel}
        strictExam={practiceMode === "exam" && mode === "in_session"}
      />
      <ExamFormulaReferenceSheet
        open={toolProfile === "testing" && examToolsUi.referenceOpen}
        onClose={() =>
          setExamToolsUi((prev) => ({
            ...prev,
            referenceOpen: false,
          }))
        }
      />
      <FloatingDesmosCalculator
        active={toolProfile === "testing" && hasMathTools}
        open={examToolsUi.calculatorOpen}
        minimized={examToolsUi.calculatorMinimized}
        topicHint={toolsTopicHint}
        desktopRect={examToolsUi.desktopRect}
        onDesktopRectChange={(next) =>
          setExamToolsUi((prev) => ({
            ...prev,
            desktopRect: next,
          }))
        }
        onClose={closeExamCalculator}
        onMinimize={minimizeExamCalculator}
        onRestore={restoreExamCalculator}
        sessionState={desmosSessionState}
        onSessionStateChange={setDesmosSessionState}
      />
    </main>
  );
}
