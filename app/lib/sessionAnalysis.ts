export type SessionAnswer = {
  questionId: string;
  subject: "Reading" | "Math" | string;
  topic: string | null;
  correct: boolean;
};

export type SessionTopicSummary = {
  topic: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export type SessionAnalysis = {
  reviewedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPct: number;
  failedTopics: SessionTopicSummary[];
  recoveredTopics: SessionTopicSummary[];
  primaryRepairTarget: SessionTopicSummary | null;
  outcome: "rebuild" | "stabilize" | "advance";
};

function summarizeTopics(rows: SessionAnswer[]): SessionTopicSummary[] {
  const map = new Map<string, SessionTopicSummary>();

  for (const row of rows) {
    const topic = row.topic?.trim() || "Unknown";
    if (!map.has(topic)) {
      map.set(topic, {
        topic,
        total: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
      });
    }

    const item = map.get(topic)!;
    item.total += 1;
    if (row.correct) item.correct += 1;
    else item.incorrect += 1;
  }

  const result = [...map.values()].map((item) => ({
    ...item,
    accuracy: item.total > 0 ? item.correct / item.total : 0,
  }));

  return result.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    if (a.incorrect !== b.incorrect) return b.incorrect - a.incorrect;
    return a.topic.localeCompare(b.topic);
  });
}

export function analyzeReviewSession(rows: SessionAnswer[]): SessionAnalysis {
  const reviewedCount = rows.length;
  const correctCount = rows.filter((row) => row.correct).length;
  const incorrectCount = reviewedCount - correctCount;
  const accuracyPct = reviewedCount ? Math.round((correctCount / reviewedCount) * 100) : 0;
  const topicSummary = summarizeTopics(rows);
  const failedTopics = topicSummary.filter((topic) => topic.incorrect > 0);
  const recoveredTopics = topicSummary.filter((topic) => topic.incorrect === 0 && topic.correct > 0);

  let outcome: "rebuild" | "stabilize" | "advance" = "advance";
  if (accuracyPct < 50) outcome = "rebuild";
  else if (accuracyPct < 75) outcome = "stabilize";

  return {
    reviewedCount,
    correctCount,
    incorrectCount,
    accuracyPct,
    failedTopics,
    recoveredTopics,
    primaryRepairTarget: failedTopics[0] ?? null,
    outcome,
  };
}
