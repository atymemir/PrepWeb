'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "../ui/ui";

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

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

  const [answers, setAnswers] = useState<Record<string, { selected: string; correct: boolean }>>({});
  const [saving, setSaving] = useState(false);

  const lastSubmitRef = useRef<{
    questionId: string;
    selected: string;
    isCorrect: boolean;
    timeTaken: number;
  } | null>(null);

  const q = questions[idx];
  const total = questions.length;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const correctCount = useMemo(() => Object.values(answers).filter(a => a.correct).length, [answers]);
  const accuracyPct = useMemo(() => (answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0), [answeredCount, correctCount]);

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
      const correctOpt = q.correct_option.toUpperCase();
      const isCorrect = selectedOpt === correctOpt;

      // store for retry if rpc fails mid-way
      lastSubmitRef.current = {
        questionId: q.id,
        selected: selectedOpt,
        isCorrect,
        timeTaken,
      };

      const supabase = getSupabase();
      const { error } = await supabase.rpc("record_answer_event", {
        p_question_id: q.id,
        p_selected_option: selectedOpt,
        p_is_correct: isCorrect,
        p_is_review: true,
        p_time_taken_seconds: timeTaken,
      });

      if (error) throw new Error(error.message);

      // local scoring
      setAnswers(prev => ({ ...prev, [q.id]: { selected: selectedOpt, correct: isCorrect } }));
      setFeedback({ correct: isCorrect, correctOption: correctOpt });
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

      const { error } = await supabase.rpc("record_answer_event", {
        p_question_id: t.questionId,
        p_selected_option: t.selected,
        p_is_correct: t.isCorrect,
        p_is_review: true,
        p_time_taken_seconds: t.timeTaken,
      });

      if (error) throw new Error(error.message);

      // If retry succeeds, lock UI as if it succeeded
      const correctOpt = q?.correct_option?.toUpperCase() ?? "—";
      setAnswers(prev => ({ ...prev, [t.questionId]: { selected: t.selected, correct: t.isCorrect } }));
      setFeedback({ correct: t.isCorrect, correctOption: correctOpt });
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

    setIdx(i => i + 1);
    resetQuestionUI();
    lastSubmitRef.current = null;
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Review"
        subtitle="Spaced repetition: due questions only."
        right={
          <button onClick={() => router.push("/today")} className="text-sm font-semibold text-gray-600 hover:text-black underline">
            Back
          </button>
        }
      />

      <Card
        title={mode === "in_session" ? `Due question ${idx + 1} / ${Math.max(total, 1)}` : "Review queue"}
        subtitle={mode === "in_session" ? `Accuracy so far: ${accuracyPct}%` : "Clear what’s scheduled. Wrong answers return sooner."}
        right={<Pill text={mode === "in_session" ? "Review mode" : `${questions.length} due`} />}
      >
        {loading && <div className="text-sm text-gray-600">Loading…</div>}

        {!loading && err && (
          <div>
            <div className="text-sm text-red-600">{err}</div>
            <div className="mt-4 grid gap-3">
              <PrimaryButton onClick={loadDuePreview}>Try again</PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && mode === "ready" && questions.length === 0 && (
          <div>
            <div className="text-sm text-gray-700">
              No review is due right now. Do practice to generate mistakes, or come back later.
            </div>
            <div className="mt-4 grid gap-3">
              <PrimaryButton href="/practice?subject=Reading">Practice Reading (12Q)</PrimaryButton>
              <SecondaryButton href="/practice?subject=Math">Practice Math (12Q)</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && mode === "ready" && questions.length > 0 && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Due now" value={`${questions.length}`} hint="Scheduled review items" />
              <StatBox label="Session size" value={`${limit}`} hint="Max due pulled" />
            </div>
            <div className="mt-4 text-sm text-gray-700">
              Clear due items to stop mistakes from sticking. Your correct streak schedules items further out.
            </div>
            <div className="mt-5 grid gap-3">
              <PrimaryButton onClick={startSession}>Start review</PrimaryButton>
              <SecondaryButton href="/skills">Open Skills</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && mode === "done" && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Reviewed" value={`${answeredCount}/${total}`} hint="Answered / due set" />
              <StatBox label="Accuracy" value={`${accuracyPct}%`} hint="This review session" />
            </div>

            <div className="mt-4 text-sm text-gray-700">
              Good. Keep the loop: Practice → Review → Skills.
            </div>

            <div className="mt-5 grid gap-3">
              <PrimaryButton onClick={loadDuePreview}>Check due again</PrimaryButton>
              <SecondaryButton href="/practice?subject=Reading">Practice (12Q)</SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !err && mode === "in_session" && q && (
          <div>
            <div className="text-base font-medium leading-relaxed whitespace-pre-line">
              {q.question_text}
            </div>

            <div className="mt-6 space-y-3">
              {(["A", "B", "C", "D"] as const).map(letter => {
                const chosen = selected === letter;
                const correct = locked && q.correct_option.toUpperCase() === letter;
                const wrongChosen = locked && chosen && !correct;

                let cls = "border border-gray-200";
                if (chosen) cls = "border border-black";
                if (correct) cls = "border border-green-600 bg-green-50";
                if (wrongChosen) cls = "border border-red-600 bg-red-50";

                return (
                  <button
                    key={letter}
                    onClick={() => pick(letter)}
                    className={`w-full text-left rounded-xl p-4 ${cls}`}
                    disabled={saving}
                  >
                    <div className="text-xs font-semibold text-gray-500 mb-1">{letter}</div>
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
                  className="rounded-xl bg-black text-white py-3 px-4 text-sm font-semibold disabled:opacity-60"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  {saving ? "Saving…" : "Submit"}
                </button>
              ) : (
                <button
                  className="rounded-xl bg-black text-white py-3 px-4 text-sm font-semibold disabled:opacity-60"
                  onClick={nextOrFinish}
                  disabled={saving}
                >
                  {idx === total - 1 ? "Finish" : "Next"}
                </button>
              )}

              {locked && feedback && (
                <div className="flex-1 rounded-xl border border-gray-200 p-4">
                  <div className={`font-semibold ${feedback.correct ? "text-green-700" : "text-red-700"}`}>
                    {feedback.correct ? "Correct" : "Incorrect"}
                  </div>

                  {!feedback.correct && (
                    <div className="text-sm text-gray-700 mt-1">
                      Correct answer: <span className="font-semibold">{feedback.correctOption}</span>
                    </div>
                  )}

                  {q.explanation ? (
                    <div className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                      <span className="font-semibold">Explanation:</span>{" "}
                      {q.explanation}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-600">No explanation available yet.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 text-xs text-gray-500">
        Notes: Review writes each answer immediately via <code>record_answer_event</code> to update spaced scheduling.
      </div>
    </main>
  );
}