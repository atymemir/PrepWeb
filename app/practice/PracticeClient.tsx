'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "../lib/supabase";
import { Card, LoopRail, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";
import ReportQuestion from "../components/ReportQuestion";

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
};

type AiExplanation = {
  why_correct: string;
  why_user_missed: string;
  trap_pattern: string;
  how_to_avoid: string;
};

type Mode = "setup" | "in_session" | "done";

function confidenceLabel(n: number): "Low" | "Medium" | "High" {
  if (n < 4) return "Low";
  if (n < 9) return "Medium";
  return "High";
}

export default function PracticeClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const subject = (sp.get("subject") || "Reading") as "Reading" | "Math";
  const subskill = sp.get("subskill") || "";
  const limit = 12;

  const [mode, setMode] = useState<Mode>("setup");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctOption: string } | null>(
    null
  );
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);
  const [aiExplain, setAiExplain] = useState<AiExplanation | null>(null);

  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [answers, setAnswers] = useState<Record<string, AnswerInsert>>({});
  const [saving, setSaving] = useState(false);

  const q = questions[idx];
  const total = questions.length;

  const answeredCount = Object.keys(answers).length;

  const correctCount = useMemo(() => {
    return Object.values(answers).filter((a) => a.is_correct).length;
  }, [answers]);

  const incorrectCount = useMemo(() => answeredCount - correctCount, [answeredCount, correctCount]);

  const accuracyPct = useMemo(() => {
    return answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
  }, [answeredCount, correctCount]);

  const finalPct = useMemo(() => {
    return total ? Math.round((correctCount / total) * 100) : 0;
  }, [correctCount, total]);

  const sessionOutcome = useMemo(() => {
    if (mode !== "done" || total === 0) return null;

    if (finalPct < 50) {
      return {
        title: "Weak signal",
        tone: "danger" as const,
        note: "Do not move on blindly. Open the lesson or skill map and repair the weak area first.",
      };
    }

    if (finalPct < 75) {
      return {
        title: "Partial control",
        tone: "accent" as const,
        note: "You are close, but not stable yet. One more focused set on the same weakness is the right next move.",
      };
    }

    return {
      title: "Good enough to advance",
      tone: "success" as const,
      note: "This set was clean enough. Move forward, but let review catch any mistakes that still need recovery.",
    };
  }, [mode, total, finalPct]);

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

  function resetSessionState() {
    setIdx(0);
    setAnswers({});
    resetQuestionUI();
    setMode("setup");
    setDoneFalse();
  }

  function setDoneFalse() {
    if (mode === "done") setMode("setup");
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
      resetQuestionUI();
      setMode("setup");
    } catch (e: any) {
      setErr(e?.message || "Failed to load practice.");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ensureAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, subskill]);

  function startSession() {
    setMode("in_session");
    setIdx(0);
    setAnswers({});
    resetQuestionUI();
  }

  async function submit() {
    if (!q || !selected || locked) return;

    setSaving(true);
    setErr(null);

    try {
      const timeTaken = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      const selectedOpt = selected.toUpperCase();
      const supabase = getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You need to sign in.");
      }

      const res = await fetch("/api/answer-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question_id: q.id,
          selected_option: selectedOpt,
          is_review: false,
          time_taken_seconds: timeTaken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to record practice answer.");
      }

      setAnswers((prev) => ({
        ...prev,
        [q.id]: {
          question_id: q.id,
          selected_option: selectedOpt,
          is_correct: !!data.is_correct,
          is_review: false,
          time_taken_seconds: timeTaken,
        },
      }));

      setFeedback({
        correct: !!data.is_correct,
        correctOption: String(data.correct_option || q.correct_option).toUpperCase(),
      });

      setLocked(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to record practice answer.");
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

      const res = await fetch("/api/practice-explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate AI explanation.");
      }
      setAiExplain(data);
    } catch (e: any) {
      setAiExplainError(e?.message || "Failed to generate AI explanation.");
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
    resetQuestionUI();
  }

  function finishSession() {
    setMode("done");
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Practice"
        subtitle={
          subskill
            ? `${subject} • targeted on ${subskill}`
            : `${subject} • focused 12-question session`
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
          <Card
            title="Session setup"
            subtitle="Confirm what you are about to do before you begin."
            right={<Pill text={subskill ? "Targeted" : "General"} tone="accent" />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox label="Subject" value={subject} hint="Selected practice track" accent />
              <StatBox
                label="Mode"
                value={subskill ? "Targeted" : "General"}
                hint={subskill ? "Focused on one weak subskill" : "Mixed signal-building set"}
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
                You will do a clean 12-question set, get instant feedback after each answer,
                and each answer is recorded as you submit it. Wrong answers should later feed your review loop.
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
              <SecondaryButton href={`/skills`}>Open skills</SecondaryButton>
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
          <Card
            title={`Question ${Math.min(idx + 1, total)} / ${total}`}
            subtitle={subskill ? `Focused on ${subskill}` : "General practice flow"}
            right={
              <Pill
                text={`Accuracy ${accuracyPct}%`}
                tone={accuracyPct >= 75 ? "success" : accuracyPct >= 50 ? "accent" : "neutral"}
              />
            }
            accent
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox label="Answered" value={`${answeredCount}`} hint="Completed so far" />
              <StatBox label="Correct" value={`${correctCount}`} hint="Right answers" accent={correctCount > 0} />
              <StatBox label="Remaining" value={`${Math.max(total - answeredCount, 0)}`} hint="Still ahead" />
              <StatBox label="Subject" value={subject} hint={subskill ? subskill : "General set"} />
            </div>
          </Card>

          <Card title="Current item" subtitle="Choose the best answer, then inspect the explanation.">
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

            <div className="mt-6 flex gap-3 items-start">
              {!locked ? (
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

              {locked && feedback && (
                <div className="flex-1 rounded-xl border border-gray-200 p-4">
                  <div className={`font-semibold ${feedback.correct ? "text-green-700" : "text-red-700"}`}>
                    {feedback.correct ? "Correct" : "Incorrect"}
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
                    <div className="mt-3 text-sm text-gray-600">
                      No explanation available yet.
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={generateAiExplanation}
                      disabled={aiExplainLoading}
                      className="rounded-lg border border-[#c7dbff] bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#004aad] transition hover:bg-[#dfeeff] disabled:opacity-60"
                    >
                      {aiExplainLoading
                        ? "Generating AI explanation..."
                        : aiExplain
                        ? "Refresh AI explanation"
                        : "Explain with AI"}
                    </button>
                  </div>

                  {aiExplainError && (
                    <div className="mt-3 text-sm text-red-600">{aiExplainError}</div>
                  )}

                  {aiExplain && (
                    <div className="mt-4 rounded-xl border border-[#c7dbff] bg-[#f6faff] p-4">
                      <div className="text-sm font-semibold text-[#004aad]">AI breakdown</div>
                      <div className="mt-3 text-sm text-gray-800">
                        <span className="font-semibold">Why the correct answer works:</span>{" "}
                        {aiExplain.why_correct}
                      </div>
                      <div className="mt-3 text-sm text-gray-800">
                        <span className="font-semibold">Why your choice missed:</span>{" "}
                        {aiExplain.why_user_missed}
                      </div>
                      <div className="mt-3 text-sm text-gray-800">
                        <span className="font-semibold">Trap pattern:</span>{" "}
                        {aiExplain.trap_pattern}
                      </div>
                      <div className="mt-3 text-sm text-gray-800">
                        <span className="font-semibold">How to avoid it next time:</span>{" "}
                        {aiExplain.how_to_avoid}
                      </div>
                    </div>
                  )}

                  {q && (
                    <ReportQuestion
                      questionId={q.id}
                      source="PracticeWeb"
                      subject={subject}
                      subskill={subskill || q.topic || undefined}
                    />
                  )}

                  <div className="mt-4 text-xs text-gray-500">
                    Practice generates forward signal. Review handles later recovery.
                  </div>
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
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatBox
                label="Score"
                value={`${correctCount}/${total}`}
                hint="Correct / total"
                accent={accuracyPct >= 50}
              />
              <StatBox
                label="Accuracy"
                value={`${finalPct}%`}
                hint="This practice session"
                accent={accuracyPct >= 75}
              />
              <StatBox label="Incorrect" value={`${incorrectCount}`} hint="Likely to feed review" />
              <StatBox label="Signal" value={confidenceLabel(total)} hint="Based on session size" />
            </div>

            {sessionOutcome && (
              <div className="mt-5 text-sm leading-relaxed text-gray-700">{sessionOutcome.note}</div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PrimaryButton onClick={ensureAuthAndLoad}>Run again</PrimaryButton>
              <SecondaryButton href="/skills">Open skills</SecondaryButton>
              <SecondaryButton href="/review">Open review</SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
