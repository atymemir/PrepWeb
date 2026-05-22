import { getSupabase } from "./supabase";

export type AnswerMode = "practice" | "review";

export type RecordAnswerInput = {
  questionId: string;
  selectedOption: string;
  mode: AnswerMode;
  timeTakenSeconds: number;
};

export type RecordedAnswer = {
  questionId: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
};

export async function recordAnswerEvent(input: RecordAnswerInput): Promise<RecordedAnswer> {
  const supabase = getSupabase();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error("You need to sign in.");
  }

  const selectedOption = input.selectedOption.toUpperCase();
  const res = await fetch("/api/answer-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      question_id: input.questionId,
      selected_option: selectedOption,
      is_review: input.mode === "review",
      time_taken_seconds: input.timeTakenSeconds,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Failed to record answer.");
  }

  return {
    questionId: String(data.question_id || input.questionId),
    selectedOption: String(data.selected_option || selectedOption).toUpperCase(),
    correctOption: String(data.correct_option || "").toUpperCase(),
    isCorrect: !!data.is_correct,
  };
}
