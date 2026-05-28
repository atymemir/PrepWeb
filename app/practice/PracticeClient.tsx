'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  masteryTone,
  movementFor,
  movementTone,
  type MasteryState,
  type MovementState,
} from "../lib/mastery";
import { normalizePlanTier, tierDefinition, type PlanTier } from "../lib/productTiers";
import { useStudentState } from "../lib/useStudentState";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import QuestionActionBlock from "../components/QuestionActionBlock";
import { SessionPayoffCard } from "../components/EngagementSystem";
import MathToolsLayer from "../components/MathToolsLayer";
import StudyFeedbackFX from "../components/StudyFeedbackFX";
import TestingToolsDock from "../components/TestingToolsDock";
import ExamFormulaReferenceSheet from "../components/ExamFormulaReferenceSheet";
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

const DEFAULT_EXAM_CALCULATOR_RECT: DesktopWindowRect = {
  x: 56,
  y: 106,
  width: 540,
  height: 430,
};

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
  const [shareText, setShareText] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
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
  const [postSessionDueCount, setPostSessionDueCount] = useState<number | null>(null);
  const [postSessionMasteryProbe, setPostSessionMasteryProbe] = useState<MasteryProbe | null>(null);
  const [postSessionSignalsNotice, setPostSessionSignalsNotice] = useState<string | null>(null);
  const [examNavigatorOpen, setExamNavigatorOpen] = useState(false);
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
    ? focusedPracticeHref(repairSubject, repairTopic, true)
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

  const postSessionRoute = useMemo(() => {
    if (practiceMode === "exam") {
      if ((postSessionDueCount ?? 0) > 0) {
        return {
          primaryLabel: "Clear review queue",
          primaryHref: "/review",
          secondaryLabel: repairTopic ? "Run targeted repair" : "Replay exam mode",
          secondaryHref: repairTopic ? repairPracticeHref : `/practice?subject=${subject}&mode=exam`,
        };
      }
      if (repairTopic) {
        return {
          primaryLabel: "Run targeted repair",
          primaryHref: repairPracticeHref,
          secondaryLabel: "Open review queue",
          secondaryHref: "/review",
        };
      }
      return {
        primaryLabel: "Open review queue",
        primaryHref: "/review",
        secondaryLabel: "Run next practice block",
        secondaryHref: `/practice?subject=${subject}`,
      };
    }

    if (repairTopic) {
      if ((postSessionDueCount ?? 0) > 0) {
        return {
          primaryLabel: "Clear review queue",
          primaryHref: "/review",
          secondaryLabel: "Run targeted repair",
          secondaryHref: repairPracticeHref,
        };
      }
      return {
        primaryLabel: "Run targeted repair",
        primaryHref: repairPracticeHref,
        secondaryLabel: "Open lesson",
        secondaryHref: repairLessonHref,
      };
    }

    return {
      primaryLabel: "Run next set",
      primaryHref: "",
      secondaryLabel: "Open review",
      secondaryHref: "/review",
    };
  }, [practiceMode, postSessionDueCount, repairTopic, repairPracticeHref, repairLessonHref, subject]);

  const executionDelta = useMemo(() => {
    if (!baselineLastSession) return null;
    return {
      accuracyDelta: analysis.accuracyPct - baselineLastSession.accuracyPct,
      xpDelta: (sessionPayoff?.totalAwarded ?? momentum.sessionXp) - baselineLastSession.xpAwarded,
    };
  }, [baselineLastSession, analysis.accuracyPct, sessionPayoff?.totalAwarded, momentum.sessionXp]);

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
  }

  function toggleOptionElimination(letter: OptionLetter) {
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
  }

  function openToolSurface() {
    if (toolProfile === "testing") {
      setExamToolsUi((prev) => ({
        ...prev,
        calculatorOpen: true,
        calculatorMinimized: false,
      }));
      return;
    }
    setToolsOpen(true);
  }

  function closeExamCalculator() {
    setExamToolsUi((prev) => ({
      ...prev,
      calculatorOpen: false,
      calculatorMinimized: false,
    }));
  }

  function minimizeExamCalculator() {
    setExamToolsUi((prev) => {
      if (!prev.calculatorOpen) return prev;
      return { ...prev, calculatorMinimized: true };
    });
  }

  function restoreExamCalculator() {
    setExamToolsUi((prev) => ({
      ...prev,
      calculatorOpen: true,
      calculatorMinimized: false,
    }));
  }

  function toggleExamReference() {
    setExamToolsUi((prev) => ({
      ...prev,
      referenceOpen: !prev.referenceOpen,
    }));
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

      const usesFreshPool = !subskill && !includeSeen;
      const usesRevisitPool = !usesFreshPool;
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
        const targetSubskill = subskill || null;

        if (usesFreshPool || usesRevisitPool) {
          nextList = await fetchDisciplinedPool({
            targetSubject: subject,
            targetSubskill,
            targetLimit: limit,
            mode: usesFreshPool ? "fresh" : "revisit",
          });
        }

        if (!nextList) {
          const base = await fetchQuestions({
            targetSubject: subject,
            targetSubskill,
            targetLimit: fallbackFetchLimit,
          });
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
          "No revisit questions are currently available for this filter. Run fresh mode or clear review debt first."
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
      setShareText("");
      setCopiedShare(false);
      setSessionClientId(createClientSessionId());
      setHistorySessionId(null);
      setFinalAnalysis(null);
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
    setBaselineLastSession(identity?.lastSession ?? null);
    setFinalAnalysis(null);
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

  const hydratePostSessionSignals = useCallback(async (args: {
    source: Record<string, AnswerInsert>;
    sourceAnalysis: SessionAnalysis;
  }) => {
    setPostSessionSignalsNotice(null);
    setPostSessionDueCount(null);
    setPostSessionMasteryProbe(null);

    const supabase = getSupabase();

    try {
      const dueRes = await supabase.rpc("get_due_review_questions", { p_limit: 120 });
      if (dueRes.error) throw new Error(dueRes.error.message);
      setPostSessionDueCount(((dueRes.data ?? []) as Array<{ id: string }>).length);
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
        outcome: sourceAnalysis.outcome,
        scoreBandLow: scoreBand.low,
        scoreBandHigh: scoreBand.high,
        topics: buildTopicSnapshots(source),
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
  }, [answers, sessionClientId, total, practiceMode, subject, subskill, examStartedAtMs, scoreBand.low, scoreBand.high, hydratePostSessionSignals, refreshStudentState]);

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

  const poolModeLabel = subskill
    ? "Targeted revisit"
    : includeSeen
    ? "Explicit revisit"
    : "Fresh pool";

  const modeLabel =
    practiceMode === "trainer" ? "Trainer" : practiceMode === "timed" ? "Timed" : "Exam";

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

  const modeExecutionIdentity =
    practiceMode === "trainer"
      ? "Immediate feedback, explanation, and rapid correction."
      : practiceMode === "timed"
      ? "Per-question pressure with enforced locks and no drifting."
      : "Strict SAT-like block: save answers, review navigator, submit once.";

  const estimatedBlockMinutes = useMemo(() => {
    if (!questions.length) return 0;
    if (practiceMode === "exam") return Math.max(1, Math.round(examTimeLimitSeconds(questions) / 60));
    if (practiceMode === "timed") {
      const baseSubject = subject === "Combined" ? "Combined" : subject;
      return Math.max(1, Math.round((questionTimeLimitSeconds(baseSubject) * questions.length) / 60));
    }
    return Math.max(1, Math.round((questions.length * 78) / 60));
  }, [practiceMode, questions, subject]);

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
        label={subskill ? "Targeted training" : "Fresh practice"}
        title="Practice"
        subtitle={
          subskill
            ? `${subjectSummary} • ${modeLabel} mode • ${poolModeLabel} • focused on ${subskill}`
            : `${subjectSummary} • ${modeLabel} mode • ${poolModeLabel} • focused 12-question session`
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
                    const lockedByTier = m.key === "exam" && !tier.limits.examMode;
                    return (
                      <button
                        key={m.key}
                        onClick={() => {
                          if (lockedByTier) {
                            router.push("/pricing");
                            return;
                          }
                          setPracticeMode(m.key);
                        }}
                        disabled={lockedByTier}
                        className={[
                          "rounded-xl border p-4 text-left transition disabled:cursor-not-allowed",
                          active
                            ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33] shadow-sm"
                            : lockedByTier
                            ? "border-[#4a5a7a] bg-white/5 text-[#8fa2c4] opacity-70"
                            : "border-[#3e557e] bg-white/5 text-white hover:border-[#5f7dae] hover:bg-white/10",
                        ].join(" ")}
                      >
                        <div className={`text-sm font-semibold ${active ? "text-[#0f1b33]" : lockedByTier ? "text-[#9fb2d3]" : "text-white"}`}>
                          {m.label}
                          {lockedByTier && <span className="ml-1 text-[10px] uppercase tracking-[0.12em]">Pro+</span>}
                        </div>
                        <div className={`mt-2 text-xs ${active ? "text-[#23375d]" : lockedByTier ? "text-[#8fa2c4]" : "text-[#cfdbf3]"}`}>{m.note}</div>
                      </button>
                    );
                  })}
                </div>

                {planNotice && (
                  <div className="mt-3 rounded-xl border border-[#5872a7] bg-white/10 px-3 py-3 text-xs text-[#d6e3fb]">
                    {planNotice}
                  </div>
                )}

                {!subskill && (
                  <div className="mt-3 rounded-xl border border-[#3e557e] bg-white/5 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">
                      Question pool discipline
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => switchPoolMode(false)}
                        className={[
                          "rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                          !includeSeen
                            ? "border-[#8ab8ff] bg-[#edf5ff] text-[#0f1b33]"
                            : "border-[#4b628f] bg-white/10 text-[#d8e4fb] hover:bg-white/15",
                        ].join(" ")}
                      >
                        Fresh only
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
                        Explicit revisit
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-[#c8d4ed]">
                      Fresh mode is server-enforced unseen and not-due. Revisit mode is intentional seen-question drilling.
                    </div>
                  </div>
                )}

                {subskill && (
                  <div className="mt-3 rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-xs text-[#c8d4ed]">
                    Targeted subskill mode is treated as explicit revisit by design.
                  </div>
                )}

                {poolNotice && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                    {poolNotice}
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-sm text-[#cbd8f0]">
                    Subject: <span className="font-semibold text-white">{subject}</span>
                  </div>
                  <div className="rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-sm text-[#cbd8f0]">
                    Mode: <span className="font-semibold text-white">{modeLabel}</span>
                  </div>
                  <div className="rounded-xl border border-[#3e557e] bg-white/5 px-3 py-3 text-sm text-[#cbd8f0]">
                    Pool: <span className="font-semibold text-white">{poolModeLabel}</span>
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
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Execution profile</div>
                  <div className="mt-2 text-sm text-[#d2dbec]">{modeExecutionIdentity}</div>
                  <div className="mt-3 text-xs text-[#c8d4ed]">
                    Estimated block: {estimatedBlockMinutes}m • {questions.length} questions
                  </div>
                  {identity && identityStatus && (
                    <div className="mt-3 text-xs text-[#c8d4ed]">
                      {identityStatus.division.label} L{identityStatus.level} • {identity.streakDays}d streak
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Pool policy</div>
                  <div className="mt-2 text-sm text-[#d2dbec]">
                    {!includeSeen && !subskill
                      ? "Fresh-only rotation. Seen and due-review questions are blocked from casual replay."
                      : "Intentional revisit mode. Pulls prior-seen questions first for explicit reinforcement."}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Current plan</div>
                  <div className="mt-2 text-sm font-semibold text-white">{tier.label}</div>
                  <div className="mt-1 text-xs text-[#c8d4ed]">{tier.tagline}</div>
                  {!tier.limits.examMode && (
                    <Link href="/pricing" className="mt-3 inline-flex text-xs font-semibold text-[#b9d6ff] underline">
                      Unlock exam shell in Pro
                    </Link>
                  )}
                </div>

                {studentState && (
                  <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Shared student state</div>
                    <div className="mt-2 text-sm text-[#d2dbec]">
                      Debt {studentState.reviewDebt.dueCount} • Recommended mode {studentState.recommendedPracticeMode}
                    </div>
                    {studentState.weakestSkill && (
                      <div className="mt-1 text-xs text-[#c8d4ed]">
                        Weakest: {studentState.weakestSkill.subskill} ({studentState.weakestSkill.accuracyPct}% • {studentState.weakestSkill.confidence} confidence)
                      </div>
                    )}
                    <div className="mt-3 text-xs text-[#c8d4ed]">{studentState.recommendedAction.reason}</div>
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
                    onClick={openToolSurface}
                    className="rounded-lg border border-[#4f6693] bg-white/10 px-3 py-2 text-xs font-semibold text-[#d7e3fb]"
                  >
                    Open Bluebook tools
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
                <Pill text={modePill} tone={modePillTone} />
                <Pill text={poolModeLabel} tone={includeSeen || subskill ? "accent" : "neutral"} />
                <Pill text={`Combo ${momentum.combo}`} tone={momentum.currentStreak >= 4 ? "success" : "neutral"} />
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
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#c8d4ed] sm:grid-cols-4">
              <div>Answered {practiceMode === "exam" ? examAnsweredCount : answeredCount}</div>
              <div>Correct {correctCount}</div>
              <div>Session XP {momentum.sessionXp}</div>
              <div className="sm:text-right">Energy {momentum.energy}%</div>
            </div>
            <div className="mt-2 text-xs text-[#9db0d2]">{momentumStateLabel}</div>
            {practiceMode === "exam" && (
              <div className="mt-3 rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-xs text-[#cedaf1]">
                Bluebook shell behavior: save answers, mark uncertain items, use question map, then submit from checkpoint.
              </div>
            )}
            {practiceMode === "exam" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-xs text-[#cedaf1]">
                  Marked: <span className="font-semibold text-white">{examMarkedCount}</span>
                </div>
                <div className="rounded-lg border border-[#3f557f] bg-white/5 px-3 py-2 text-xs text-[#cedaf1]">
                  Unanswered: <span className="font-semibold text-white">{examUnansweredCount}</span>
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
            {practiceMode === "exam" && examSections.length > 1 && (
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
                    Accuracy: <span className="font-semibold text-white">{analysis.accuracyPct}%</span>
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
                {executionDelta && (
                  <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Change vs previous block</div>
                    <div className="mt-2 text-sm text-[#d2dbec]">
                      Accuracy {executionDelta.accuracyDelta >= 0 ? "+" : ""}{executionDelta.accuracyDelta}%
                      <span className="mx-1 text-[#7389b4]">•</span>
                      XP {executionDelta.xpDelta >= 0 ? "+" : ""}{executionDelta.xpDelta}
                    </div>
                  </div>
                )}
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
                    value={`${analysis.accuracyPct}%`}
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
                  {postSessionRoute.primaryHref ? (
                    <PrimaryButton href={postSessionRoute.primaryHref}>{postSessionRoute.primaryLabel}</PrimaryButton>
                  ) : (
                    <PrimaryButton onClick={ensureAuthAndLoad}>{postSessionRoute.primaryLabel}</PrimaryButton>
                  )}
                  <SecondaryButton href={postSessionRoute.secondaryHref}>
                    {postSessionRoute.secondaryLabel}
                  </SecondaryButton>
                </div>
                {repairTopic && (
                  <div className="mt-4 rounded-2xl border border-[#d7e5fb] bg-[#f6faff] p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                      Lesson bridge
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      Repair the pattern, then rerun the exact subtopic.
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <SecondaryButton href={repairLessonHref}>Open lesson</SecondaryButton>
                      <SecondaryButton href={repairPracticeHref}>Focused retry</SecondaryButton>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  What changed in this block
                </div>
                <div className="mt-3 grid gap-2">
                  {analysis.recoveredTopics.slice(0, 2).map((topic) => (
                    <div key={`recovered-${topic.topic}`} className="rounded-lg border border-[#9de0bb] bg-[#ebfdf2] px-3 py-2 text-sm text-[#0f8a4e]">
                      Recovered: <span className="font-semibold">{topic.topic}</span> ({Math.round(topic.accuracy * 100)}%)
                    </div>
                  ))}
                  {analysis.failedTopics.slice(0, 2).map((topic) => (
                    <div key={`failed-${topic.topic}`} className="rounded-lg border border-[#f5b8c4] bg-[#fff2f5] px-3 py-2 text-sm text-[#b02039]">
                      Still weak: <span className="font-semibold">{topic.topic}</span> ({Math.round(topic.accuracy * 100)}%)
                    </div>
                  ))}
                  {analysis.recoveredTopics.length === 0 && analysis.failedTopics.length === 0 && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Not enough topic movement yet. Run another focused block.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Post-session system state
                </div>
                <div className="mt-3 grid gap-2">
                  {postSessionDueCount !== null && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Due for review now: <span className="font-semibold text-black">{postSessionDueCount}</span>
                    </div>
                  )}
                  {postSessionMasteryProbe && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                      <div className="text-sm font-semibold text-black">{postSessionMasteryProbe.topic}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {postSessionMasteryProbe.subject} • {postSessionMasteryProbe.accuracyPct}% • {postSessionMasteryProbe.attempts} attempts
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill text={postSessionMasteryProbe.mastery} tone={masteryTone(postSessionMasteryProbe.mastery)} />
                        <Pill text={postSessionMasteryProbe.movement} tone={movementTone(postSessionMasteryProbe.movement)} />
                      </div>
                    </div>
                  )}
                  {postSessionSignalsNotice && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {postSessionSignalsNotice}
                    </div>
                  )}
                  {studentState && (
                    <div className="rounded-lg border border-[#d7e5fb] bg-[#f6faff] px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                        Unified state command
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[#0f1b33]">
                        {studentState.recommendedAction.title}
                      </div>
                      <div className="mt-1 text-xs text-gray-700">{studentState.recommendedAction.reason}</div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <SecondaryButton href={studentState.recommendedAction.primaryHref}>
                          {studentState.recommendedAction.primaryLabel}
                        </SecondaryButton>
                        <SecondaryButton href={studentState.recommendedAction.secondaryHref}>
                          {studentState.recommendedAction.secondaryLabel}
                        </SecondaryButton>
                      </div>
                    </div>
                  )}
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
