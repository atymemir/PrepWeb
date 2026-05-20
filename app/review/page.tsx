'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "@/app/ui/ui";

export default function ReviewPage() {

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

  const supabase = getSupabase();
  const router = useRouter();
  const limit = 12;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctOption: string } | null>(null);

  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [answers, setAnswers] = useState<Record<string, { selected: string; correct: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const q = questions[idx];
  const total = questions.length;

  const correctCount = useMemo(() => Object.values(answers).filter(a => a.correct).length, [answers]);
  const answeredCount = Object.keys(answers).length;
  const accuracyPct = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;

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

  function pick(letter: string) {
    if (locked) return;
    setSelected(letter);
  }

  async function loadReviewSet() {
    setLoading(true);
    setErr(null);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase.rpc("get_due_review_questions", { p_limit: limit });
    setLoading(false);

    if (error) {
      setErr(error.message);
      setQuestions([]);
      return;
    }

    const list = (data ?? []) as Question[];
    if (!list.length) {
      setQuestions([]);
      return;
    }

    setQuestions(list);
    setIdx(0);
    setSelected(null);
    setLocked(false);
    setFeedback(null);
    setAnswers({});
    setStartedAt(Date.now());
    setDone(false);
  }

  useEffect(() => {
    loadReviewSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!q || !selected) return;

    const timeTaken = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const isCorrect = selected.toUpperCase() === q.correct_option.toUpperCase();

    // immediately record event server-side (this updates spacing schedule)
    const { error } = await supabase.rpc("record_answer_event", {
      p_question_id: q.id,
      p_selected_option: selected.toUpperCase(),
      p_is_correct: isCorrect,
      p_is_review: true,
      p_time_taken_seconds: timeTaken,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setAnswers(prev => ({ ...prev, [q.id]: { selected: selected.toUpperCase(), correct: isCorrect } }));
    setFeedback({ correct: isCorrect, correctOption: q.correct_option.toUpperCase() });
    setLocked(true);
  }

  async function nextOrFinish() {
    if (!q) return;

    const isLast = idx >= questions.length - 1;
    if (isLast) {
      setDone(true);
      return;
    }

    setIdx(i => i + 1);
    setSelected(null);
    setLocked(false);
    setFeedback(null);
    setStartedAt(Date.now());
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Review"
        subtitle="Spaced repetition: due questions only. Your streak schedules the next review."
        right={<button onClick={() => router.push("/today")} className="text-sm underline text-gray-700">Back</button>}
      />

      {loading && (
        <Card title="Loading…" subtitle="Fetching due review questions">
          <div className="text-sm text-gray-600">Please wait.</div>
        </Card>
      )}

      {!loading && err && (
        <Card title="Error" subtitle="Review could not load">
          <div className="text-sm text-red-600">{err}</div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton onClick={loadReviewSet}>Try again</PrimaryButton>
            <SecondaryButton href="/today">Back to today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && questions.length === 0 && (
        <Card title="No review due" subtitle="Nothing is scheduled right now">
          <div className="text-sm text-gray-700">
            You’re clear. Do practice to generate new mistakes, or come back later.
          </div>
          <div className="mt-4 grid gap-3">
            <PrimaryButton href="/practice?subject=Reading">Practice Reading (12Q)</PrimaryButton>
            <SecondaryButton href="/practice?subject=Math">Practice Math (12Q)</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && done && (
        <Card title="Review complete" subtitle="Good work">
          <div className="grid grid-cols-2 gap-4">
            <StatBox label="Reviewed" value={`${answeredCount}/${total}`} hint="Answered / due set" />
            <StatBox label="Accuracy" value={`${accuracyPct}%`} hint="This review session" />
          </div>

          <div className="mt-4 text-sm text-gray-700">
            Your correct streak schedules items further out. Wrong answers return sooner.
          </div>

          <div className="mt-5 grid gap-3">
            <PrimaryButton onClick={loadReviewSet}>Check due again</PrimaryButton>
            <SecondaryButton href="/skills">Go to Skills</SecondaryButton>
            <SecondaryButton href="/today">Back to Today</SecondaryButton>
          </div>
        </Card>
      )}

      {!loading && !err && !done && q && (
        <Card
          title={`Due question ${idx + 1} / ${total}`}
          subtitle={`Accuracy so far: ${accuracyPct}%`}
          right={<Pill text="Review mode" />}
        >
          <div className="text-base font-medium leading-relaxed whitespace-pre-line">
            {q.question_text}
          </div>

          <div className="mt-6 space-y-3">
            {(["A", "B", "C", "D"] as const).map(letter => {
              const chosen = selected === letter;
              const correct = locked && q.correct_option.toUpperCase() === letter;
              const wrongChosen = locked && chosen && !correct;

              let cls = "border";
              if (chosen) cls = "border-black";
              if (correct) cls = "border-green-600 bg-green-50";
              if (wrongChosen) cls = "border-red-600 bg-red-50";

              return (
                <button
                  key={letter}
                  onClick={() => pick(letter)}
                  className={`w-full text-left rounded-xl p-4 ${cls}`}
                  disabled={saving}
                >
                  <div className="text-xs font-semibold text-gray-500 mb-1">{letter}</div>
                  <div className="text-sm text-gray-800">{optionText(letter)}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3 items-start">
            {!locked ? (
              <PrimaryButton onClick={submit} disabled={!selected || saving}>
                Submit
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={nextOrFinish} disabled={saving}>
                {idx === total - 1 ? "Finish" : "Next"}
              </PrimaryButton>
            )}

            {locked && feedback && (
              <div className="flex-1 rounded-xl border p-4">
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
                  <div className="mt-3 text-sm text-gray-600">No explanation available.</div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </main>
  );
}
