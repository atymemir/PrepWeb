'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type AnswerInsert = {
  user_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  is_review: boolean;
  time_taken_seconds: number;
};

type LocalAnswer = Omit<AnswerInsert, "user_id">;

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; correctOption: string } | null>(null);

  const [startedAt, setStartedAt] = useState<number>(Date.now());

  // answers in state for UI + in ref for race-free saving
  const [answersState, setAnswersState] = useState<Record<string, LocalAnswer>>({});
  const answersRef = useRef<Record<string, LocalAnswer>>({});

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [done, setDone] = useState(false);
  const [dueCount, setDueCount] = useState<number | null>(null);

  const q = questions[idx];
  const total = questions.length;

  const answeredCount = useMemo(() => Object.keys(answersState).length, [answersState]);
  const correctCount = useMemo(
    () => Object.values(answersState).filter(a => a.is_correct).length,
    [answersState]
  );

  const accuracyPct = useMemo(() => {
    if (!answeredCount) return 0;
    return Math.round((correctCount / answeredCount) * 100);
  }, [answeredCount, correctCount]);

  const headerSubtitle = useMemo(() => {
    const base = `${subject}${subskill ? ` • ${subskill}` : ""} • ${limit}Q`;
    return base;
  }, [subject, subskill, limit]);

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
    if (locked || saving) return;
    setSelected(letter);
  }

  function resetQuestionUI() {
    setSelected(null);
    setLocked(false);
    setFeedback(null);
    setStartedAt(Date.now());
  }

  async function ensureAuthAndLoad() {
    setLoading(true);
    setLoadErr(null);
    setSaveErr(null);
    setDone(false);
    setDueCount(null);

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

      answersRef.current = {};
      setAnswersState({});
      resetQuestionUI();

    } catch (e: any) {
      setLoadErr(e?.message || "Failed to load practice.");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ensureAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, subskill]);

  function recordAnswer(question: Question, chosen: string) {
    const timeTaken = clampInt(Math.round((Date.now() - startedAt) / 1000), 0, 60 * 60);
    const selectedOpt = chosen.toUpperCase();
    const correctOpt = question.correct_option.toUpperCase();
    const isCorrect = selectedOpt === correctOpt;

    const entry: LocalAnswer = {
      question_id: question.id,
      selected_option: selectedOpt,
      is_correct: isCorrect,
      is_review: false,
      time_taken_seconds: timeTaken,
    };

    // update ref synchronously (race-free)
    answersRef.current = { ...answersRef.current, [question.id]: entry };
    // update state for UI
    setAnswersState(prev => ({ ...prev, [question.id]: entry }));

    setFeedback({ correct: isCorrect, correctOption: correctOpt });
    setLocked(true);
  }

  async function submit() {
    if (!q || !selected || locked) return;
    recordAnswer(q, selected);
  }

  async function nextOrFinish() {
    if (!q) return;

    const isLast = idx >= questions.length - 1;
    if (isLast) {
      await finishSession();
      return;
    }

    setIdx(i => i + 1);
    resetQuestionUI();
  }

  async function fetchDueCount() {
    try {
      const supabase = getSupabase();
      const due = await supabase.rpc("get_due_review_questions", { p_limit: 50 });
      if (due.error) return null;
      const list = (due.data ?? []) as Array<{ id: string }>;
      return list.length;
    } catch {
      return null;
    }
  }

  async function finishSession() {
    setSaving(true);
    setSaveErr(null);

    try {
      const rows = Object.values(answersRef.current);
      if (!rows.length) throw new Error("No answers to save.");
      if (!userId) throw new Error("Missing user session.");

      const payload: AnswerInsert[] = rows.map(r => ({ user_id: userId, ...r }));

      const supabase = getSupabase();
      const { error } = await supabase.from("user_responses").insert(payload);
      if (error) throw new Error(error.message);

      // optionally refresh due review count for a better CTA
      const due = await fetchDueCount();
      setDueCount(due);

      setDone(true);
    } catch (e: any) {
      setSaveErr(e?.message || "Failed to save session.");
    } finally {
      setSaving(false);
    }
  }

  async function retrySave() {
    await finishSession();
  }

  function exitToToday() {
    router.push("/today");
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Practice"
        subtitle={headerSubtitle}
        right={
          <button
            onClick={exitToToday}
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
          >
            Exit
          </button>
        }
      />

      <Card
        title={`Question ${Math.min(idx + 1, Math.max(total, 1))} / ${Math.max(total, 1)}`}
        subtitle={done ? "Session summary" : "Answer, then continue."}
        right={<Pill text={`Accuracy ${accuracyPct}%`} />}
      >
        {loading && <div className="text-sm text-gray-600">Loading questions…</div>}

        {!loading && loadErr && (
          <div className="text-sm text-red-600">
            {loadErr}
            <div className="mt-4 grid gap-3">
              <PrimaryButton onClick={ensureAuthAndLoad}>Try again</PrimaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !loadErr && done && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Score" value={`${correctCount}/${total}`} hint="Correct / total" />
              <StatBox label="Accuracy" value={`${total ? Math.round((correctCount / total) * 100) : 0}%`} hint="This session" />
            </div>

            <div className="mt-4 text-sm text-gray-700">
              {dueCount !== null
                ? (dueCount > 0
                    ? `You now have ${dueCount} review questions due. Clearing them keeps mistakes from sticking.`
                    : "No review due right now. Good. Keep practicing.")
                : "Next step: do review (if due) or run another clean 12Q set."}
            </div>

            {saveErr && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Save failed: {saveErr}
                <div className="mt-3 grid gap-2">
                  <PrimaryButton onClick={retrySave} disabled={saving}>
                    {saving ? "Retrying…" : "Retry save"}
                  </PrimaryButton>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-3">
              {dueCount !== null && dueCount > 0 ? (
                <PrimaryButton href="/review">Go to Review</PrimaryButton>
              ) : (
                <PrimaryButton href={`/practice?subject=${encodeURIComponent(subject)}`}>Practice another 12Q</PrimaryButton>
              )}
              <SecondaryButton onClick={ensureAuthAndLoad}>New set (reload)</SecondaryButton>
              <SecondaryButton href="/today">Back to Today</SecondaryButton>
            </div>
          </div>
        )}

        {!loading && !loadErr && !done && q && (
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

            <div className="mt-6 flex gap-3 items-start">
              {!locked ? (
                <button
                  className="rounded-xl bg-black text-white py-3 px-4 text-sm font-semibold disabled:opacity-60"
                  onClick={submit}
                  disabled={!selected || saving}
                >
                  Submit
                </button>
              ) : (
                <button
                  className="rounded-xl bg-black text-white py-3 px-4 text-sm font-semibold disabled:opacity-60"
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
                      No explanation available yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            {saveErr && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Save error: {saveErr}
                <div className="mt-3 grid gap-2">
                  <PrimaryButton onClick={retrySave} disabled={saving}>
                    {saving ? "Retrying…" : "Retry save"}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="mt-6 text-xs text-gray-500">
        Notes: This is session-based saving (batched at the end). If saving fails, use “Retry save”.
      </div>
    </main>
  );
}