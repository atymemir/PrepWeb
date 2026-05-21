'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

function nextStepLabel(accuracyPct: number, total: number) {
  if (total === 0) return "Start fresh practice";
  if (accuracyPct < 50) return "Open lesson and re-practice";
  if (accuracyPct < 75) return "Do one focused practice set";
  return "Return to forward practice";
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

  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [answers, setAnswers] = useState<Record<string, ReviewAnswer>>({});
  const [saving, setSaving] = useState(false);

  const lastSubmitRef = useRef<{
    questionId: string;
    selected: string;
    timeTaken: number;
  } | null>(null);

  const q = questions[idx];
  const total = questions.length;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const correctCount = useMemo(
    () => Object.values(answers).filter((a) => a.correct).length,
    [answers]
  );
  const accuracyPct = useMemo(
    () => (answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0),
    [answeredCount, correctCount]
  );

  const queueTone = useMemo(() => {
    if (questions.length === 0) return "success" as const;
    if (questions.length <= 4) return "accent" as const;
    if (questions.length <= 8) return "accent" as const;
    return "danger" as const;
  }, [questions.length]);

  const postReviewNextStep = useMemo(
    () => nextStepLabel(accuracyPct, total),
    [accuracyPct, total]
  );

  const reviewTarget = useMemo(() => {
    const missed = Object.values(answers).filter((answer) => !answer.correct && answer.topic);
    if (!missed.length) return null;

    const ranked = [...missed].sort((a, b) => {
      const aCount = missed.filter((x) => x.topic === a.topic).length;
      const bCount = missed.filter((x) => x.topic === b.topic).length;
      if (aCount !== bCount) return bCount - aCount;
      return a.topic!.localeCompare(b.topic!);
    });

    return ranked[0];
  }, [answers]);

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
      await ensureAuth();

      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("get_due_review_questions", { p_limit: limit });
      if (error) throw new Error(error.message);

      const list = (data ?? []) as Question[];
      setQuestions(list);
    } catch (e: any) {
      setErr(e?.message || "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    if (!questions.length) return;
    setMode("in_session");
    setIdx(0);
    resetQuestionUI();
    setAnswers({});
    lastSubmitRef.current = null;
  }

  useEffect(() => {
    loadDuePreview();
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
          is_review: true,
          time_taken_seconds: timeTaken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to record review answer.");
      }

      setAnswers((prev) => ({
        ...prev,
        [q.id]: {
          selected: selectedOpt,
          correct: !!data.is_correct,
          subject: q.subject,
          topic: q.topic,
        },
      }));

      setFeedback({
        correct: !!data.is_correct,
        correctOption: String(data.correct_option || q.correct_option).toUpperCase(),
      });
      setLocked(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to record review answer.");
    } finally {
      setSaving(false);
    }
  }

  async function retryRecord() {
    if (!lastSubmitRef.current) return;

    setSaving(true);
    setErr(null);

    try {
      const supabase = getSupabase();
      const t = lastSubmitRef.current;
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
          question_id: t.questionId,
          selected_option: t.selected,
          is_review: true,
          time_taken_seconds: t.timeTaken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Retry failed.");
      }

      const correctOpt = String(data.correct_option || q?.correct_option || "—").toUpperCase();

      setAnswers((prev) => ({
        ...prev,
        [t.questionId]: {
          selected: t.selected,
          correct: !!data.is_correct,
          subject: q?.subject ?? "Reading",
          topic: q?.topic ?? null,
        },
      }));

      setFeedback({ correct: !!data.is_correct, correctOption: correctOpt });
      setLocked(true);
    } catch (e: any) {
      setErr(e?.message || "Retry failed.");
    } finally {
      setSaving(false);
    }
  }

  function nextOrFinish() {
    if (!q) return;

    const isLast = idx >= questions.length - 1;
    if (isLast) {
      setMode("done");
      return;
    }

    setIdx((i) => i + 1);
    resetQuestionUI();
    lastSubmitRef.current = null;
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Review"
        subtitle="Recovery workflow. Clear due mistakes before you push new practice."
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
        <div className="grid gap-4">
          <Card
            title="Recovery queue"
            subtitle="What is due now should be cleared before more forward work."
            right={<Pill text={queueLabel(questions.length)} tone={queueTone} />}
            accent={questions.length > 0}
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
        <Card
          title={`Recovery item ${idx + 1} / ${Math.max(total, 1)}`}
          subtitle={`Accuracy so far: ${accuracyPct}%`}
          right={<Pill text="Review mode" tone="accent" />}
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
                {q && (
                  <ReportQuestion
                    questionId={q.id}
                    source="ReviewWeb"
                    subject={q.subject}
                    subskill={q.topic || undefined}
                  />
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {!loading && !err && mode === "done" && (
        <div className="grid gap-4">
          <Card
            title="Recovery session complete"
            subtitle="Now decide what should happen next."
            right={<Pill text={postReviewNextStep} tone={accuracyPct >= 75 ? "success" : accuracyPct >= 50 ? "accent" : "danger"} />}
            accent
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <StatBox
                label="Reviewed"
                value={`${answeredCount}/${total}`}
                hint="Answered / queued"
              />
              <StatBox
                label="Accuracy"
                value={`${accuracyPct}%`}
                hint="This recovery session"
                accent={accuracyPct >= 50}
              />
              <StatBox
                label="Next move"
                value={postReviewNextStep}
                hint="Based on recovery quality"
              />
            </div>

            <div className="mt-5 text-sm text-gray-700">
              {accuracyPct < 50
                ? reviewTarget
                  ? `Recovery was weak. Start repair on ${reviewTarget.topic} before adding broad new practice.`
                  : "Recovery was weak. Do not just move on. Open the skills map and rebuild the unstable concept."
                : accuracyPct < 75
                ? reviewTarget
                  ? `Recovery was partial. One focused practice set on ${reviewTarget.topic} is the right next step.`
                  : "Recovery was partial. One focused practice set on the weak area is the right next step."
                : "Recovery was clean enough. You can safely return to normal forward practice."}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PrimaryButton onClick={loadDuePreview}>Check due again</PrimaryButton>
              {reviewTarget?.topic ? (
                <>
                  <SecondaryButton
                    href={`/lesson/${encodeURIComponent(reviewTarget.topic)}`}
                  >
                    Open repair lesson
                  </SecondaryButton>
                  <SecondaryButton
                    href={`/practice?subject=${reviewTarget.subject}&subskill=${encodeURIComponent(
                      reviewTarget.topic
                    )}`}
                  >
                    Practice missed skill
                  </SecondaryButton>
                </>
              ) : (
                <>
                  <SecondaryButton href="/skills">Open skills</SecondaryButton>
                  <SecondaryButton href="/practice?subject=Reading">Go to practice</SecondaryButton>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
