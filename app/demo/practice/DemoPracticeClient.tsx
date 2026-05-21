'use client';

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_QUESTIONS, type DemoQuestion } from "@/app/data/demoQuestions";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton, StatBox } from "@/app/ui/ui";

export default function DemoPracticeClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const subject = (sp.get("subject") || "Reading") as "Reading" | "Math";

  const questions = useMemo(() => {
    return DEMO_QUESTIONS.filter((q) => q.subject === subject);
  }, [subject]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { selected: string; correct: boolean }>>({});

  const q: DemoQuestion | undefined = questions[idx];
  const total = questions.length;

  const correctCount = useMemo(
    () => Object.values(answers).filter((a) => a.correct).length,
    [answers]
  );

  const accuracyPct = total ? Math.round((correctCount / Math.max(Object.keys(answers).length, 1)) * 100) : 0;

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

  function submit() {
    if (!q || !selected || locked) return;
    const correct = selected === q.correct_option;
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { selected, correct },
    }));
    setLocked(true);
  }

  function nextOrFinish() {
    if (!q) return;
    if (idx >= total - 1) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setLocked(false);
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Demo Practice"
        subtitle={`${subject} • Public walkthrough`}
        right={
          <button
            onClick={() => router.push("/demo")}
            className="text-sm font-semibold text-gray-600 hover:text-black underline"
          >
            Back
          </button>
        }
      />

      <Card
        title={done ? "Demo summary" : `Question ${Math.min(idx + 1, Math.max(total, 1))} / ${Math.max(total, 1)}`}
        subtitle={done ? "You’ve finished the public demo." : "Try the flow without logging in."}
        right={<Pill text={done ? "Demo complete" : `${subject}`} />}
      >
        {done ? (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Score" value={`${correctCount}/${total}`} hint="Correct / total" />
              <StatBox
                label="Accuracy"
                value={`${total ? Math.round((correctCount / total) * 100) : 0}%`}
                hint="This demo session"
              />
            </div>

            <div className="mt-4 text-sm text-gray-700">
              Demo mode does not save progress. For real practice history, review scheduling, skills, and community,
              create an account and use the full app.
            </div>

            <div className="mt-5 grid gap-3">
              <PrimaryButton href={`/demo/practice?subject=${subject}`}>Run demo again</PrimaryButton>
              <SecondaryButton href="/login">Create account</SecondaryButton>
              <SecondaryButton href="/">Back to home</SecondaryButton>
            </div>
          </div>
        ) : q ? (
          <div>
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              {q.subskill}
            </div>

            <div className="text-base font-medium leading-relaxed whitespace-pre-line">
              {q.question_text}
            </div>

            <div className="mt-6 space-y-3">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const chosen = selected === letter;
                const correct = locked && q.correct_option === letter;
                const wrongChosen = locked && chosen && !correct;

                let cls = "border border-gray-200";
                if (chosen) cls = "border border-black";
                if (correct) cls = "border border-green-600 bg-green-50";
                if (wrongChosen) cls = "border border-red-600 bg-red-50";

                return (
                  <button
                    key={letter}
                    onClick={() => !locked && setSelected(letter)}
                    className={`w-full rounded-xl p-4 text-left ${cls}`}
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
                  onClick={submit}
                  disabled={!selected}
                  className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  Submit
                </button>
              ) : (
                <button
                  onClick={nextOrFinish}
                  className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {idx === total - 1 ? "Finish" : "Next"}
                </button>
              )}

              {locked && (
                <div className="flex-1 rounded-xl border border-gray-200 p-4">
                  <div className={`font-semibold ${selected === q.correct_option ? "text-green-700" : "text-red-700"}`}>
                    {selected === q.correct_option ? "Correct" : "Incorrect"}
                  </div>

                  {selected !== q.correct_option && (
                    <div className="mt-1 text-sm text-gray-700">
                      Correct answer: <span className="font-semibold">{q.correct_option}</span>
                    </div>
                  )}

                  <div className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                    <span className="font-semibold">Explanation:</span> {q.explanation}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Demo progress is temporary. Use the full app for saved sessions, review, and skill tracking.
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            No demo questions available.
            <div className="mt-4">
              <Link className="underline text-gray-700 hover:text-black" href="/demo">
                Back to demo
              </Link>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
