import { type SessionTopicSnapshot } from "./sessionHistory";

export type TopicAnswerSignal = {
  subject: string | null | undefined;
  topic: string | null | undefined;
  correct: boolean;
};

export function createClientSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildTopicSnapshots(answers: TopicAnswerSignal[]): SessionTopicSnapshot[] {
  const buckets = new Map<string, { subject: string | null; correct: number; total: number }>();

  for (const answer of answers) {
    const key = answer.topic?.trim() || "Unknown";
    if (!buckets.has(key)) {
      buckets.set(key, { subject: answer.subject || null, correct: 0, total: 0 });
    }

    const bucket = buckets.get(key)!;
    bucket.total += 1;
    if (answer.correct) bucket.correct += 1;
  }

  return [...buckets.entries()].map(([topic, value]) => ({
    topic,
    subject: value.subject,
    correctCount: value.correct,
    totalCount: value.total,
  }));
}
