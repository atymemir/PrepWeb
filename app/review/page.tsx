'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  type SessionMomentum,
  type SessionPayoff,
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

  const accuracyPct = reviewAnalysis.accuracyPct;

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

  const repairTopic = reviewAnalysis.primaryRepairTarget?.topic ?? null;
  const repairSubject = useMemo(() => {
    if (!repairTopic) return "Reading";
    const found = Object.values(answers).find(
      (answer) => (answer.topic?.trim() || "Unknown") === repairTopic
    );
    return (found?.subject as "Reading" | "Math") || "Reading";
  }, [answers, repairTopic]);

  const repairLessonHref = useMemo(() => {
    if (!repairTopic) return "/lessons";
    return `/lesson/${encodeURIComponent(repairTopic)}`;
  }, [repairTopic]);

  const repairPracticeHref = useMemo(() => {
    if (!repairTopic) return "/practice?subject=Reading";
    return `/practice?subject=${repairSubject}&subskill=${encodeURIComponent(repairTopic)}`;
  }, [repairTopic, repairSubject]);

  const outcomePill = useMemo(() => {
    if (reviewAnalysis.outcome === "rebuild") {
      return { text: "Rebuild", tone: "danger" as const };
    }
    if (reviewAnalysis.outcome === "stabilize") {
      return { text: "Stabilize", tone: "accent" as const };
    }
    return { text: "Advance", tone: "success" as const };
  }, [reviewAnalysis.outcome]);

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
    resetQuestionUI();
    setAnswers({});
    lastSubmitRef.current = null;
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
    const answered = Object.keys(answers).length;
    const correct = Object.values(answers).filter((answer) => answer.correct).length;

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
        <div className="grid gap-6">
          {identity && identityStatus && (
            <IdentityStatusCard
              identity={identity}
              status={identityStatus}
              title="Recovery identity"
              subtitle={`${identityStatus.division.label} • Level ${identityStatus.level}`}
              note="Review sessions now carry full identity and streak weight, so recovery behavior is visibly rewarded."
            />
          )}

          {engagementNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {engagementNotice}
            </div>
          )}

          <Card
            title="Recovery queue"
            subtitle="Finish what is due now to preserve momentum and protect your streak quality."
            right={<Pill text={queueLabel(questions.length)} tone={queueTone} />}
            accent={questions.length > 0}
            prominence={questions.length > 0 ? "prominent" : "quiet"}
          >
            {questions.length === 0 ? (
              <>
                <div className="text-sm text-gray-700">
                  No review is due right now. Good. That means your queue is clear and you can safely return to fresh practice.
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton href="/practice?subject=Reading">Practice Reading</PrimaryButton>
                  <SecondaryButton href="/practice?subject=Math">Practice Math</SecondaryButton>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatBox
                    label="Due now"
                    value={String(questions.length)}
                    hint="Items currently scheduled"
                    accent
                  />
                  <StatBox
                    label="Session cap"
                    value={String(limit)}
                    hint="Maximum pulled into this queue"
                  />
                  <StatBox
                    label="Priority"
                    value={questions.length >= 6 ? "High" : "Normal"}
                    hint="Based on current due load"
                  />
                </div>

                <div className="mt-5 text-sm leading-relaxed text-gray-700">
                  Review is the repair half of the system. Clear due items now so mistakes do not remain active when you go back into fresh practice.
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton onClick={startSession}>Start review</PrimaryButton>
                  <SecondaryButton href="/skills">Open skills</SecondaryButton>
                </div>
              </>
            )}
          </Card>

          {questions.length > 0 && (
            <Card title="What happens after review?" subtitle="The next action depends on how cleanly you recover.">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatBox label="<50%" value="Rebuild" hint="Open lesson, then practice again" />
                <StatBox label="50–74%" value="Stabilize" hint="Do one focused practice set" accent />
                <StatBox label="75%+" value="Advance" hint="Return to normal forward work" />
              </div>
            </Card>
          )}
        </div>
      )}

      {!loading && !err && mode === "in_session" && q && (
        <div className="grid gap-4">
          <MomentumRail
            momentum={momentum}
            title="Recovery momentum"
            subtitle="Clear the queue with steady accuracy to keep identity momentum intact."
          />

          <Card
            title={`Recovery item ${idx + 1} / ${Math.max(total, 1)}`}
            subtitle={`Why this is here: ${currentReviewReason ?? "new mistake"} • Accuracy so far: ${accuracyPct}%`}
            right={<Pill text={currentReviewReason ?? "Review mode"} tone="accent" />}
            accent
          >
            <div className="text-base font-medium leading-relaxed whitespace-pre-line text-black">
              {q.question_text}
            </div>

            <div className="mt-6 space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const chosen = selected === letter;
                const correct = locked && q.correct_option.toUpperCase() === letter;
                const wrongChosen = locked && chosen && !correct;

                let cls = "border border-gray-200 bg-white";
                if (chosen) cls = "border-[#004aad] bg-[#eef4ff]";
                if (correct) cls = "border-green-600 bg-green-50";
                if (wrongChosen) cls = "border-red-600 bg-red-50";

                return (
                  <button
                    key={letter}
                    onClick={() => pick(letter)}
                    className={`w-full rounded-xl p-4 text-left ${cls}`}
                    disabled={saving}
                  >
                    <div className="mb-1 text-xs font-semibold text-gray-500">{letter}</div>
                    <div className="text-sm text-gray-900">{optionText(letter)}</div>
                  </button>
                );
              })}
            </div>

            {err && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
                  className="rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88] disabled:opacity-60"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  {saving ? "Saving…" : "Submit"}
                </button>
              ) : (
                <button
                  className="rounded-xl bg-[#004aad] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003b88] disabled:opacity-60"
                  onClick={nextOrFinish}
                  disabled={saving}
                >
                  {idx === total - 1 ? "Finish" : "Next"}
                </button>
              )}

              {locked && feedback && (
                <div className="flex-1 rounded-xl border border-gray-200 p-4">
                  <div className={`font-semibold ${feedback.correct ? "text-green-700" : "text-red-700"}`}>
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
        </div>
      )}

      {!loading && !err && mode === "done" && (
        <div className="grid gap-4">
          <Card
            title="Recovery session complete"
            subtitle="Use the result to choose the exact next repair step."
            right={<Pill text={outcomePill.text} tone={outcomePill.tone} />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox
                label="Reviewed"
                value={`${reviewAnalysis.reviewedCount}`}
                hint="Items completed"
              />
              <StatBox
                label="Correct"
                value={`${reviewAnalysis.correctCount}`}
                hint="Recovered items"
                accent={reviewAnalysis.correctCount > 0}
              />
              <StatBox
                label="Incorrect"
                value={`${reviewAnalysis.incorrectCount}`}
                hint="Still unstable"
                accent={reviewAnalysis.incorrectCount > 0}
              />
              <StatBox
                label="Accuracy"
                value={`${reviewAnalysis.accuracyPct}%`}
                hint="This review session"
                accent={reviewAnalysis.accuracyPct >= 75}
              />
            </div>
            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Session interpretation
              </div>
              {reviewAnalysis.outcome === "rebuild" && (
                <div className="mt-2 text-sm leading-relaxed text-gray-700">
                  Recovery was weak. Do not just move on. A concept or trap pattern is still unstable and needs targeted repair.
                </div>
              )}
              {reviewAnalysis.outcome === "stabilize" && (
                <div className="mt-2 text-sm leading-relaxed text-gray-700">
                  Recovery was partial. You are close, but one topic still needs focused reinforcement before forward work becomes efficient.
                </div>
              )}
              {reviewAnalysis.outcome === "advance" && (
                <div className="mt-2 text-sm leading-relaxed text-gray-700">
                  Recovery was clean enough. You can return to forward practice, but keep review active so relapse stays under control.
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
                  {reviewAnalysis.primaryRepairTarget && (
                    <>
                      {" "}• Accuracy in this session: {Math.round(reviewAnalysis.primaryRepairTarget.accuracy * 100)}%
                      {" "}({reviewAnalysis.primaryRepairTarget.correct}/{reviewAnalysis.primaryRepairTarget.total})
                    </>
                  )}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                  <PrimaryButton href={repairPracticeHref}>Practice this topic</PrimaryButton>
                  <SecondaryButton href={repairLessonHref}>Open lesson</SecondaryButton>
                </div>
              </div>
            )}
            {reviewAnalysis.recoveredTopics.length > 0 && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Recovered cleanly
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reviewAnalysis.recoveredTopics.slice(0, 6).map((topic) => (
                    <Pill
                      key={topic.topic}
                      text={`${topic.topic} • ${Math.round(topic.accuracy * 100)}%`}
                      tone="success"
                    />
                  ))}
                </div>
              </div>
            )}
            {reviewAnalysis.failedTopics.length > 1 && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Other weak topics from this session
                </div>
                <div className="mt-3 grid gap-2">
                  {reviewAnalysis.failedTopics.slice(1, 4).map((topic) => (
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

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PrimaryButton onClick={loadDuePreview}>Check due again</PrimaryButton>
              <SecondaryButton href={repairPracticeHref}>Targeted practice</SecondaryButton>
              <SecondaryButton href="/skills">Open skills</SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
