export type AiExplanation = {
  why_correct: string;
  why_user_missed: string;
  trap_pattern: string;
  how_to_avoid: string;
};

export type ExplainQuestionPayload = {
  subject: string;
  subskill?: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  selected_option: string;
  explanation?: string | null;
};

export async function requestQuestionExplanation(
  accessToken: string,
  payload: ExplainQuestionPayload
): Promise<AiExplanation> {
  const res = await fetch("/api/practice-explain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Failed to generate AI explanation.");
  }

  return data as AiExplanation;
}
