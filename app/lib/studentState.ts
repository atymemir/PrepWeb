import { getSupabase } from "./supabase";
import { getDurableEngagementSnapshot, type DurableEngagementSnapshot } from "./engagementDurable";
import { getStudySessions, type StudySessionMode, type StudySessionRecord } from "./sessionHistory";
import {
  weaknessScore,
  type SkillRow,
} from "./learningSignals";
import {
  focusedLessonHref,
  focusedPracticeHref,
  masteryFor,
  movementFor,
  type MasteryState,
  type MovementState,
  type Subject,
} from "./mastery";
import { normalizePlanTier, tierDefinition, type PlanTier } from "./productTiers";

export type StudentStateRoute =
  | "today"
  | "practice"
  | "review"
  | "skills"
  | "history"
  | "lessons"
  | "coach"
  | "community"
  | "other";

export type StudentActionKind =
  | "recover_debt"
  | "attack_weak_skill"
  | "replay_recent"
  | "generate_signal";

export type DueQuestion = {
  id: string;
  subject: string | null;
  topic: string | null;
};

export type WeakSkillSignal = {
  subject: Subject;
  subskill: string;
  domain: string;
  skill: string;
  attempts: number;
  accuracy: number;
  accuracyPct: number;
  confidence: "Low" | "Medium" | "High";
  mastery: MasteryState;
  movement: MovementState;
};

export type MasteryDistribution = {
  Mastered: number;
  Growing: number;
  Unstable: number;
  Untouched: number;
};

export type MovementDistribution = {
  Building: number;
  Stuck: number;
  Volatile: number;
  Stable: number;
};

export type TopicDelta = {
  topic: string;
  delta: number;
};

export type SessionMovementProof = {
  latest: StudySessionRecord | null;
  previousComparable: StudySessionRecord | null;
  accuracyDelta: number | null;
  correctDelta: number | null;
  durationDeltaMinutes: number | null;
  biggestGain: TopicDelta | null;
  biggestDrop: TopicDelta | null;
};

export type RecommendedAction = {
  kind: StudentActionKind;
  title: string;
  reason: string;
  payoff: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

export type ContextualCoachMessage = {
  id: string;
  tone: "neutral" | "accent" | "danger" | "success";
  text: string;
  actionHref?: string;
  actionLabel?: string;
};

export type StudentState = {
  profile: {
    nickname: string;
    examDate: string | null;
    planTier: PlanTier;
    planLabel: string;
    examModeAvailable: boolean;
  };
  engagement: {
    streakDays: number;
    bestStreakDays: number;
    divisionLabel: string;
    level: number;
    overallAccuracyPct: number;
    statusLabel: string;
  } | null;
  reviewDebt: {
    dueCount: number;
    blockSize: number;
    pressure: "clear" | "light" | "moderate" | "heavy";
    topTopics: Array<{ topic: string; subject: string; count: number }>;
  };
  weakestSkill: WeakSkillSignal | null;
  weakSkillTargets: WeakSkillSignal[];
  masteryDistribution: MasteryDistribution;
  movementDistribution: MovementDistribution;
  unstableCount: number;
  lowSignalCount: number;
  recommendedPracticeMode: "trainer" | "timed" | "exam";
  recommendedAction: RecommendedAction;
  recentMovement: SessionMovementProof;
  historyProof: {
    lastSessionLabel: string;
    lastMovementText: string;
  };
  contextualMessages: Record<StudentStateRoute, ContextualCoachMessage[]>;
};

export type StudentStateFetchOptions = {
  dueLimit?: number;
  historyLimit?: number;
};

function safeAccuracy(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function safeAttempts(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(Number(value)));
}

function confidenceLabel(attempts: number): "Low" | "Medium" | "High" {
  if (attempts < 6) return "Low";
  if (attempts < 15) return "Medium";
  return "High";
}

function toWeakSkillSignal(subject: Subject, row: SkillRow): WeakSkillSignal {
  const attempts = safeAttempts(row.attempts);
  const accuracy = safeAccuracy(row.accuracy);
  return {
    subject,
    subskill: row.subskill,
    domain: row.domain,
    skill: row.skill,
    attempts,
    accuracy,
    accuracyPct: Math.round(accuracy * 100),
    confidence: confidenceLabel(attempts),
    mastery: masteryFor({ attempts: row.attempts, accuracy: row.accuracy }),
    movement: movementFor({ attempts: row.attempts, accuracy: row.accuracy }),
  };
}

function buildWeakSkillTargets(readingRows: SkillRow[], mathRows: SkillRow[], limit = 6): WeakSkillSignal[] {
  return [
    ...readingRows.map((row) => ({ subject: "Reading" as const, row })),
    ...mathRows.map((row) => ({ subject: "Math" as const, row })),
  ]
    .sort((a, b) => {
      const aScore = weaknessScore(a.row);
      const bScore = weaknessScore(b.row);
      if (aScore !== bScore) return aScore - bScore;

      const aAttempts = safeAttempts(a.row.attempts);
      const bAttempts = safeAttempts(b.row.attempts);
      if (aAttempts !== bAttempts) return bAttempts - aAttempts;

      return a.row.subskill.localeCompare(b.row.subskill);
    })
    .slice(0, limit)
    .map(({ subject, row }) => toWeakSkillSignal(subject, row));
}

function debtPressure(count: number): "clear" | "light" | "moderate" | "heavy" {
  if (count <= 0) return "clear";
  if (count <= 4) return "light";
  if (count <= 12) return "moderate";
  return "heavy";
}

function summarizeMastery(rows: SkillRow[]): MasteryDistribution {
  const summary: MasteryDistribution = {
    Mastered: 0,
    Growing: 0,
    Unstable: 0,
    Untouched: 0,
  };

  for (const row of rows) {
    const mastery = masteryFor({ attempts: row.attempts, accuracy: row.accuracy });
    summary[mastery] += 1;
  }

  return summary;
}

function summarizeMovement(rows: SkillRow[]): MovementDistribution {
  const summary: MovementDistribution = {
    Building: 0,
    Stuck: 0,
    Volatile: 0,
    Stable: 0,
  };

  for (const row of rows) {
    const movement = movementFor({ attempts: row.attempts, accuracy: row.accuracy });
    summary[movement] += 1;
  }

  return summary;
}

function topicKey(topic: string | null | undefined): string {
  const clean = (topic ?? "").trim();
  return clean || "Unknown";
}

function summarizeDueTopics(rows: DueQuestion[]): Array<{ topic: string; subject: string; count: number }> {
  const map = new Map<string, { topic: string; subject: string; count: number }>();

  for (const row of rows) {
    const topic = topicKey(row.topic);
    const subject = row.subject === "Math" ? "Math" : "Reading";
    const key = `${subject}:${topic}`;
    if (!map.has(key)) {
      map.set(key, { topic, subject, count: 0 });
    }
    map.get(key)!.count += 1;
  }

  return [...map.values()]
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.topic.localeCompare(b.topic);
    })
    .slice(0, 4);
}

function isMissingRpc(error: { code?: string; message?: string } | null | undefined, rpcName: string): boolean {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "PGRST202" || message.includes(rpcName.toLowerCase());
}

export function hasComparableSessionShape(a: StudySessionRecord, b: StudySessionRecord): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === "review") return true;
  if ((a.subject ?? "Mixed") !== (b.subject ?? "Mixed")) return false;
  if ((a.variant ?? "") !== (b.variant ?? "")) return false;
  if ((a.subskill ?? "") !== (b.subskill ?? "")) return false;
  return true;
}

function sessionMovementProof(sessions: StudySessionRecord[]): SessionMovementProof {
  const latest = sessions[0] ?? null;
  if (!latest) {
    return {
      latest: null,
      previousComparable: null,
      accuracyDelta: null,
      correctDelta: null,
      durationDeltaMinutes: null,
      biggestGain: null,
      biggestDrop: null,
    };
  }

  let previousComparable: StudySessionRecord | null = null;
  for (let i = 1; i < sessions.length; i += 1) {
    if (hasComparableSessionShape(latest, sessions[i])) {
      previousComparable = sessions[i];
      break;
    }
  }

  if (!previousComparable) {
    return {
      latest,
      previousComparable: null,
      accuracyDelta: null,
      correctDelta: null,
      durationDeltaMinutes: null,
      biggestGain: null,
      biggestDrop: null,
    };
  }

  const previousTopicMap = new Map(previousComparable.topics.map((topic) => [topic.topic, topic.accuracyPct]));
  const deltas = latest.topics
    .filter((topic) => previousTopicMap.has(topic.topic))
    .map((topic) => ({
      topic: topic.topic,
      delta: topic.accuracyPct - (previousTopicMap.get(topic.topic) ?? topic.accuracyPct),
    }))
    .sort((a, b) => a.delta - b.delta);

  const biggestDrop = deltas.find((topic) => topic.delta < 0) ?? null;
  const biggestGain = [...deltas].reverse().find((topic) => topic.delta > 0) ?? null;

  return {
    latest,
    previousComparable,
    accuracyDelta: latest.accuracyPct - previousComparable.accuracyPct,
    correctDelta: latest.correctCount - previousComparable.correctCount,
    durationDeltaMinutes: Math.round((latest.durationSeconds - previousComparable.durationSeconds) / 60),
    biggestGain,
    biggestDrop,
  };
}

function recommendedMode(args: {
  debtCount: number;
  weakest: WeakSkillSignal | null;
  sessions: StudySessionRecord[];
  examModeAvailable: boolean;
}): "trainer" | "timed" | "exam" {
  if (args.debtCount > 0) return "trainer";
  if (!args.weakest) return "trainer";

  if (args.weakest.mastery === "Unstable" && args.weakest.attempts < 6) {
    return "trainer";
  }

  if (args.weakest.movement === "Stuck" || args.weakest.movement === "Volatile") {
    return "timed";
  }

  if (!args.examModeAvailable) return "timed";

  const latest = args.sessions[0];
  if (!latest) return "timed";
  if (latest.mode === "review") return "timed";
  if (latest.accuracyPct >= 78 && latest.answeredCount >= 10) return "exam";

  return "timed";
}

function createRecommendedAction(args: {
  debtCount: number;
  weakest: WeakSkillSignal | null;
  movement: SessionMovementProof;
  recommendedPracticeMode: "trainer" | "timed" | "exam";
}): RecommendedAction {
  const modeLabel =
    args.recommendedPracticeMode === "trainer"
      ? "quick practice"
      : args.recommendedPracticeMode === "timed"
      ? "timed set"
      : "full practice test";

  if (args.debtCount > 0) {
    const block = Math.min(12, args.debtCount);
    return {
      kind: "recover_debt",
      title: `Review ${block} mistakes first`,
      reason: args.debtCount > 12
        ? `You have ${args.debtCount} mistakes waiting for review. New practice now will blur the weak areas.`
        : `You have ${args.debtCount} mistakes waiting for review. Review should come first.`,
      payoff: "Clears old mistakes so your next practice set gives cleaner evidence.",
      primaryHref: "/review",
      primaryLabel: "Start review block",
      secondaryHref: args.weakest
        ? focusedPracticeHref(args.weakest.subject, args.weakest.subskill)
        : "/practice?subject=Reading",
      secondaryLabel: args.weakest ? `Practice ${args.weakest.subskill}` : "Start focused practice",
    };
  }

  if (args.weakest) {
    return {
      kind: "attack_weak_skill",
      title: `Practice ${args.weakest.subskill}`,
      reason: `${args.weakest.accuracyPct}% over ${args.weakest.attempts} attempts in ${args.weakest.subject}. ${args.weakest.confidence} confidence.`,
      payoff: "This is your biggest score opportunity right now.",
      primaryHref: focusedPracticeHref(args.weakest.subject, args.weakest.subskill),
      primaryLabel: `Start ${modeLabel}`,
      secondaryHref: focusedLessonHref(args.weakest.subskill),
      secondaryLabel: "Open repair lesson",
    };
  }

  if (args.movement.latest) {
    return {
      kind: "replay_recent",
      title: "Replay your last session shape",
      reason: "Your weak areas are not stable yet. Repeating a comparable block makes progress easier to measure.",
      payoff: "Creates clear before/after evidence for your next decision.",
      primaryHref: "/history",
      primaryLabel: "Replay from history",
      secondaryHref: "/practice?subject=Reading",
      secondaryLabel: "Run fresh block",
    };
  }

  return {
    kind: "generate_signal",
    title: "Complete your first short set",
    reason: "You need one finished practice block before the system can prioritize weak areas.",
    payoff: "Unlocks your first real daily plan.",
    primaryHref: "/practice?subject=Reading",
    primaryLabel: "Start practice",
    secondaryHref: "/skills",
    secondaryLabel: "Open skills map",
  };
}

function historyProofText(movement: SessionMovementProof): { lastSessionLabel: string; lastMovementText: string } {
  if (!movement.latest) {
    return {
      lastSessionLabel: "No recorded session yet",
      lastMovementText: "Run one block to start movement proof.",
    };
  }

  const latest = movement.latest;
  const modeLabel = latest.mode === "review" ? "Review" : latest.mode === "exam" ? "Exam" : "Practice";
  const lastSessionLabel = `${modeLabel} • ${latest.accuracyPct}% • ${latest.correctCount}/${latest.answeredCount}`;

  if (movement.accuracyDelta === null) {
    return {
      lastSessionLabel,
      lastMovementText: "No comparable prior block yet. Replay the same shape to unlock deltas.",
    };
  }

  const accDelta = movement.accuracyDelta >= 0 ? `+${movement.accuracyDelta}%` : `${movement.accuracyDelta}%`;
  const gain = movement.biggestGain ? `Gain ${movement.biggestGain.topic} (+${movement.biggestGain.delta}%)` : "No topic gain yet";
  const drop = movement.biggestDrop
    ? `Drop ${movement.biggestDrop.topic} (${movement.biggestDrop.delta}%)`
    : "No topic drop";

  return {
    lastSessionLabel,
    lastMovementText: `Accuracy ${accDelta}. ${gain}. ${drop}.`,
  };
}

function buildContextualMessages(args: {
  route: StudentStateRoute;
  debtCount: number;
  weakest: WeakSkillSignal | null;
  action: RecommendedAction;
  movement: SessionMovementProof;
  recommendedMode: "trainer" | "timed" | "exam";
}): ContextualCoachMessage[] {
  const base: ContextualCoachMessage[] = [];

  if (args.debtCount > 0) {
    const clearNow = Math.min(12, args.debtCount);
    base.push({
      id: "debt-priority",
      tone: args.debtCount > 12 ? "danger" : "accent",
      text: `You have ${args.debtCount} mistakes waiting for review. Clear ${clearNow} first before new volume.`,
      actionHref: "/review",
      actionLabel: "Start review",
    });
  }

  if (args.weakest) {
    const sampleCaution = args.weakest.confidence === "Low"
      ? "Signal is fragile: low sample size. Confirm with one more focused set."
      : `${args.weakest.subskill} is unstable at ${args.weakest.accuracyPct}%. Keep it in active rotation.`;

    base.push({
      id: "weakest-focus",
      tone: args.weakest.mastery === "Unstable" ? "danger" : "accent",
      text: sampleCaution,
      actionHref: focusedPracticeHref(args.weakest.subject, args.weakest.subskill),
      actionLabel: "Drill weak topic",
    });
  }

  if (args.movement.accuracyDelta !== null) {
    const trendText = args.movement.accuracyDelta >= 0
      ? `Last comparable block moved +${args.movement.accuracyDelta}% accuracy. Keep pressure while momentum is live.`
      : `Last comparable block dropped ${args.movement.accuracyDelta}%. Do not escalate difficulty until recovery is stable.`;

    base.push({
      id: "movement-proof",
      tone: args.movement.accuracyDelta >= 0 ? "success" : "accent",
      text: trendText,
      actionHref: "/history",
      actionLabel: "View movement",
    });
  }

  const routeNudge: Record<StudentStateRoute, ContextualCoachMessage> = {
    today: {
      id: "today-mission",
      tone: "accent",
      text: `Today mission: ${args.action.title}. ${args.action.payoff}`,
      actionHref: args.action.primaryHref,
      actionLabel: args.action.primaryLabel,
    },
    practice: {
      id: "practice-mode",
      tone: "accent",
      text: `Practice mode recommendation: ${args.recommendedMode}. Run full block, then route immediately.`,
      actionHref: args.action.primaryHref,
      actionLabel: args.action.primaryLabel,
    },
    review: {
      id: "review-why",
      tone: args.debtCount > 0 ? "danger" : "success",
      text: args.debtCount > 0
        ? "Review is the bottleneck right now. Clear old mistakes before adding new volume."
        : "Review is clear. Route to weak-skill practice while your queue is clean.",
      actionHref: args.debtCount > 0 ? "/review" : args.action.primaryHref,
      actionLabel: args.debtCount > 0 ? "Run review" : args.action.primaryLabel,
    },
    skills: {
      id: "skills-execution",
      tone: "accent",
      text: "Pick one unstable or volatile subtopic and execute immediately. Do not distribute focus.",
      actionHref: args.action.primaryHref,
      actionLabel: args.action.primaryLabel,
    },
    history: {
      id: "history-proof",
      tone: "neutral",
      text: "History is proof, not archive. Replay same shape or retry weakest topic right now.",
      actionHref: "/history",
      actionLabel: "Use replay routes",
    },
    lessons: {
      id: "lesson-bridge",
      tone: "neutral",
      text: "Use this lesson as a repair playbook, then return to targeted retry immediately.",
      actionHref: args.action.secondaryHref,
      actionLabel: "Run repair route",
    },
    coach: {
      id: "coach-focus",
      tone: "accent",
      text: "Coach should interpret your state and push action, not replace practice.",
      actionHref: args.action.primaryHref,
      actionLabel: args.action.primaryLabel,
    },
    community: {
      id: "community-proof",
      tone: "neutral",
      text: "Share real work proof: review queue cleared, streak held, or weak-topic improvement.",
      actionHref: "/leagues",
      actionLabel: "Share proof",
    },
    other: {
      id: "default-loop",
      tone: "neutral",
      text: "Stay inside the loop: Practice -> Review -> Skills -> Lessons -> History.",
      actionHref: args.action.primaryHref,
      actionLabel: args.action.primaryLabel,
    },
  };

  return [routeNudge[args.route], ...base].slice(0, 4);
}

async function requireProfile(userId: string): Promise<{ nickname: string; examDate: string | null; planTier: PlanTier }> {
  const supabase = getSupabase();
  let profileRes = await supabase
    .from("profiles")
    .select("nickname,exam_date,plan_tier")
    .eq("id", userId)
    .single();

  if (
    profileRes.error &&
    String(profileRes.error.message || "").toLowerCase().includes("plan_tier")
  ) {
    profileRes = await supabase
      .from("profiles")
      .select("nickname,exam_date")
      .eq("id", userId)
      .single();
  }

  if (profileRes.error) throw new Error(profileRes.error.message);

  const row = profileRes.data as {
    nickname?: string | null;
    exam_date?: string | null;
    plan_tier?: string | null;
  };

  return {
    nickname: (row.nickname ?? "Student").trim() || "Student",
    examDate: row.exam_date ?? null,
    planTier: normalizePlanTier(row.plan_tier ?? "free"),
  };
}

async function requireUserId(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id;
  if (!userId) throw new Error("You need to sign in.");
  return userId;
}

export async function fetchStudentState(options: StudentStateFetchOptions = {}): Promise<StudentState> {
  const dueLimit = options.dueLimit ?? 80;
  const historyLimit = options.historyLimit ?? 80;

  const userId = await requireUserId();
  const supabase = getSupabase();

  const [profile, engagementResult, readingRes, mathRes, dueRes, dueCountRes, sessionsResult] = await Promise.all([
    requireProfile(userId),
    getDurableEngagementSnapshot().catch(() => null as DurableEngagementSnapshot | null),
    supabase.rpc("get_skill_mastery", { p_subject: "Reading" }),
    supabase.rpc("get_skill_mastery", { p_subject: "Math" }),
    supabase.rpc("get_due_review_questions", { p_limit: dueLimit }),
    supabase.rpc("get_due_review_count", { p_scan: 2000 }),
    getStudySessions(historyLimit).catch(() => [] as StudySessionRecord[]),
  ]);

  if (readingRes.error) throw new Error(readingRes.error.message);
  if (mathRes.error) throw new Error(mathRes.error.message);
  if (dueRes.error) throw new Error(dueRes.error.message);

  const readingRows = (readingRes.data ?? []) as SkillRow[];
  const mathRows = (mathRes.data ?? []) as SkillRow[];
  const allRows = [...readingRows, ...mathRows];
  const dueQuestions = (dueRes.data ?? []) as DueQuestion[];
  let dueCount = dueQuestions.length;
  if (dueCountRes.error) {
    if (!isMissingRpc(dueCountRes.error, "get_due_review_count")) {
      throw new Error(dueCountRes.error.message);
    }
  } else {
    dueCount = Math.max(0, Number(dueCountRes.data ?? 0));
  }
  const weakSkillTargets = buildWeakSkillTargets(readingRows, mathRows);
  const weakest = weakSkillTargets[0] ?? null;

  const movement = sessionMovementProof(sessionsResult);
  const tier = tierDefinition(profile.planTier);
  const practiceMode = recommendedMode({
    debtCount: dueCount,
    weakest,
    sessions: sessionsResult,
    examModeAvailable: tier.limits.examMode,
  });

  const action = createRecommendedAction({
    debtCount: dueCount,
    weakest,
    movement,
    recommendedPracticeMode: practiceMode,
  });

  const historyProof = historyProofText(movement);

  const contextualMessages: StudentState["contextualMessages"] = {
    today: buildContextualMessages({
      route: "today",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    practice: buildContextualMessages({
      route: "practice",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    review: buildContextualMessages({
      route: "review",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    skills: buildContextualMessages({
      route: "skills",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    history: buildContextualMessages({
      route: "history",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    lessons: buildContextualMessages({
      route: "lessons",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    coach: buildContextualMessages({
      route: "coach",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    community: buildContextualMessages({
      route: "community",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
    other: buildContextualMessages({
      route: "other",
      debtCount: dueCount,
      weakest,
      action,
      movement,
      recommendedMode: practiceMode,
    }),
  };

  return {
    profile: {
      nickname: profile.nickname,
      examDate: profile.examDate,
      planTier: profile.planTier,
      planLabel: tier.label,
      examModeAvailable: tier.limits.examMode,
    },
    engagement: engagementResult
      ? {
          streakDays: engagementResult.identity.streakDays,
          bestStreakDays: engagementResult.identity.bestStreakDays,
          divisionLabel: engagementResult.status.division.label,
          level: engagementResult.status.level,
          overallAccuracyPct: engagementResult.status.overallAccuracyPct,
          statusLabel: engagementResult.status.statusLabel,
        }
      : null,
    reviewDebt: {
      dueCount,
      blockSize: Math.min(12, dueCount),
      pressure: debtPressure(dueCount),
      topTopics: summarizeDueTopics(dueQuestions),
    },
    weakestSkill: weakest,
    weakSkillTargets,
    masteryDistribution: summarizeMastery(allRows),
    movementDistribution: summarizeMovement(allRows),
    unstableCount: allRows.filter((row) => masteryFor({ attempts: row.attempts, accuracy: row.accuracy }) === "Unstable").length,
    lowSignalCount: allRows.filter((row) => safeAttempts(row.attempts) < 6).length,
    recommendedPracticeMode: practiceMode,
    recommendedAction: action,
    recentMovement: movement,
    historyProof,
    contextualMessages,
  };
}

export function routeFromPathname(pathname: string): StudentStateRoute {
  if (pathname.startsWith("/today")) return "today";
  if (pathname.startsWith("/practice")) return "practice";
  if (pathname.startsWith("/review")) return "review";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/lessons") || pathname.startsWith("/lesson")) return "lessons";
  if (pathname.startsWith("/coach")) return "coach";
  if (pathname.startsWith("/leagues")) return "community";
  return "other";
}

export function coachMessagesForPath(pathname: string, state: StudentState): ContextualCoachMessage[] {
  const route = routeFromPathname(pathname);
  return state.contextualMessages[route] ?? state.contextualMessages.other;
}

export function replaySessionHref(session: StudySessionRecord): string {
  if (session.mode === "review") return "/review";

  const params = new URLSearchParams();
  if (session.subject === "Math") params.set("subject", "Math");
  else if (session.subject === "Combined") params.set("subject", "Combined");
  else params.set("subject", "Reading");

  if (session.mode === "exam") {
    params.set("mode", "exam");
    return `/practice?${params.toString()}`;
  }

  if (session.variant === "timed" || session.variant === "exam" || session.variant === "trainer") {
    params.set("mode", session.variant);
  }

  if (session.subskill) {
    params.set("subskill", session.subskill);
    params.set("revisit", "1");
  }

  return `/practice?${params.toString()}`;
}

export function fmtSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function sessionModeLabel(mode: StudySessionMode): string {
  if (mode === "review") return "Review";
  if (mode === "exam") return "Exam";
  return "Practice";
}
