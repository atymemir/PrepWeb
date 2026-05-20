'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "../lib/supabase";

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
  user_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  is_review: boolean;
  time_taken_seconds: number;
};

export default function PracticeClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const subject = (sp.get("subject") || "Reading") as "Reading" | "Math";
  const subskill = sp.get("subskill") || "";
  const limit = 12;

  const [userId, setUserId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctOption: string } | null>(null);

  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [answers, setAnswers] = useState<Record<string, Omit<AnswerInsert, "user_id">>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const q = questions[idx];
  const total = questions.length;

  const correctCount = useMemo(() => Object.values(answers).filter(a => a.is_correct).length, [answers]);
  const answeredCount = Object.keys(answers).length;

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

      setUserId(session.user.id);

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
      setSelected(null);
      setLocked(false);
      setFeedback(null);
      setAnswers({});
      setStartedAt(Date.now());
      setDone(false);
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

  async function submit() {
    if (!q || !selected) return;

    const timeTaken = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const isCorrect = selected.toUpperCase() === q.correct_option.toUpperCase();

    setAnswers(prev => ({
      ...prev,
      [q.id]: {
        question_id: q.id,
        selected_option: selected.toUpperCase(),
        is_correct: isCorrect,
        is_review: false,
        time_taken_seconds: timeTaken,
      }
    }));

    setFeedback({ correct: isCorrect, correctOption: q.correct_option.toUpperCase() });
    setLocked(true);
  }

  async function nextOrFinish() {
    if (!q) return;

    const isLast = idx >= questions.length - 1;
    if (isLast) {
      await finishSession();
      return;
    }

    setIdx(i => i + 1);
    setSelected(null);
    setLocked(false);
    setFeedback(null);
    setStartedAt(Date.now());
  }

  async function finishSession() {
    setSaving(true);
    setErr(null);

    try {
      const rows = Object.values(answers);
      if (!rows.length) throw new Error("No answers to save.");
      if (!userId) throw new Error("Missing user session.");

      const payload: AnswerInsert[] = rows.map(r => ({ user_id: userId, ...r }));

      const supabase = getSupabase();
      const { error } = await supabase.from("user_responses").insert(payload);
      if (error) throw new Error(error.message);

      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to save session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Practice</h1>
          <p className="text-sm text-gray-600 mt-1">
            {subject}{subskill ? ` • ${subskill}` : ""} • {limit} questions
          </p>
        </div>
        <button className="text-sm underline text-gray-700" onClick={() => router.push("/today")}>
          Back
        </button>
      </div>

      <div className="mt-6 rounded-2xl border bg-white shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Question {Math.min(idx + 1, total)} / {total}
          </div>
          <div className="text-sm font-medium">
            Accuracy: {answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0}%
          </div>
        </div>

        {loading && <div className="p-4 text-sm text-gray-600">Loading questions…</div>}
        {err && <div className="p-4 text-sm text-red-600">{err}</div>}

        {!loading && !err && done && (
          <div className="p-6">
            <div className="text-xl font-semibold">Session complete</div>
            <div className="mt-2 text-sm text-gray-700">
              Score: <span className="font-semibold">{correctCount}</span> / {total} (
              {total ? Math.round((correctCount / total) * 100) : 0}%)
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="rounded-lg bg-black text-white py-3 font-medium" onClick={() => ensureAuthAndLoad()}>
                Practice again
              </button>
              <button className="rounded-lg border py-3 font-medium" onClick={() => router.push("/leagues")}>
                Go to leagues
              </button>
            </div>
          </div>
        )}

        {!loading && !err && !done && q && (
          <div className="p-6">
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
                    <div className="text-sm font-semibold mb-1">{letter}</div>
                    <div className="text-sm text-gray-800">{optionText(letter)}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3 items-start">
              {!locked ? (
                <button
                  className="rounded-lg bg-black text-white py-3 px-4 font-medium disabled:opacity-60"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  Submit
                </button>
              ) : (
                <button
                  className="rounded-lg bg-black text-white py-3 px-4 font-medium disabled:opacity-60"
                  onClick={nextOrFinish}
                  disabled={saving}
                >
                  {idx === total - 1 ? (saving ? "Saving…" : "Finish") : "Next"}
                </button>
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
                    <div className="mt-3 text-sm text-gray-600">
                      No explanation available for this question.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-500">
        MVP note: answers are saved at the end of the session.
      </div>
    </main>
  );
}