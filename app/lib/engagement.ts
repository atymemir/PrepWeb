export type SessionMode = "practice" | "review";

export type EngagementDivisionKey =
  | "foundation"
  | "cadet"
  | "operator"
  | "strategist"
  | "captain"
  | "apex";

export type EngagementDivision = {
  key: EngagementDivisionKey;
  label: string;
  minXp: number;
};

export type EngagementIdentity = {
  userId: string;
  streakDays: number;
  bestStreakDays: number;
  lifetimeXp: number;
  totalSessions: number;
  completedSessions: number;
  totalAnswers: number;
  totalCorrect: number;
  lastActiveDate: string | null;
  lastSession: {
    mode: SessionMode;
    accuracyPct: number;
    xpAwarded: number;
    completedAt: string;
    answered: number;
    correct: number;
    total: number;
    bestStreak: number;
  } | null;
};

export type EngagementStatus = {
  level: number;
  division: EngagementDivision;
  nextDivision: EngagementDivision | null;
  levelProgressPct: number;
  divisionProgressPct: number;
  xpIntoLevel: number;
  xpNeededThisLevel: number;
  overallAccuracyPct: number;
  status: "warming" | "stable" | "sharp";
  statusLabel: string;
};

export type SessionMomentum = {
  answered: number;
  total: number;
  progressPct: number;
  currentStreak: number;
  bestStreak: number;
  energy: number;
  combo: "Cold" | "Building" | "Locked In" | "Precision";
  sessionXp: number;
  instantXp: number;
  lastResult: "correct" | "incorrect" | null;
};

export type SessionPayoff = {
  baseXp: number;
  completionBonus: number;
  accuracyBonus: number;
  totalAwarded: number;
  completed: boolean;
  accuracyPct: number;
};

const DIVISIONS: EngagementDivision[] = [
  { key: "foundation", label: "Foundation", minXp: 0 },
  { key: "cadet", label: "Cadet", minXp: 320 },
  { key: "operator", label: "Operator", minXp: 920 },
  { key: "strategist", label: "Strategist", minXp: 1900 },
  { key: "captain", label: "Captain", minXp: 3200 },
  { key: "apex", label: "Apex", minXp: 5000 },
];

const XP_PER_LEVEL = 180;
const STARTING_ENERGY = 46;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeNumber(n: unknown, fallback = 0): number {
  return Number.isFinite(n) ? Number(n) : fallback;
}

export function getDivision(lifetimeXp: number): EngagementDivision {
  let current = DIVISIONS[0];
  for (const division of DIVISIONS) {
    if (lifetimeXp >= division.minXp) current = division;
  }
  return current;
}

export function getNextDivision(lifetimeXp: number): EngagementDivision | null {
  for (const division of DIVISIONS) {
    if (lifetimeXp < division.minXp) return division;
  }
  return null;
}

export function describeStatus(identity: EngagementIdentity): EngagementStatus {
  const lifetimeXp = Math.max(0, identity.lifetimeXp);
  const level = Math.floor(lifetimeXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = lifetimeXp % XP_PER_LEVEL;
  const levelProgressPct = clamp(Math.round((xpIntoLevel / XP_PER_LEVEL) * 100), 0, 100);

  const division = getDivision(lifetimeXp);
  const nextDivision = getNextDivision(lifetimeXp);
  const divisionSpan = nextDivision ? nextDivision.minXp - division.minXp : XP_PER_LEVEL * 4;
  const divisionDelta = nextDivision ? lifetimeXp - division.minXp : divisionSpan;
  const divisionProgressPct = clamp(
    Math.round((divisionDelta / Math.max(divisionSpan, 1)) * 100),
    0,
    100
  );

  const overallAccuracyPct = identity.totalAnswers
    ? clamp(Math.round((identity.totalCorrect / identity.totalAnswers) * 100), 0, 100)
    : 0;

  let status: EngagementStatus["status"] = "warming";
  let statusLabel = "Warming up";
  if (identity.streakDays >= 3 && overallAccuracyPct >= 55) {
    status = "stable";
    statusLabel = "Consistent rhythm";
  }
  if (identity.streakDays >= 7 && overallAccuracyPct >= 70) {
    status = "sharp";
    statusLabel = "Locked in";
  }

  return {
    level,
    division,
    nextDivision,
    levelProgressPct,
    divisionProgressPct,
    xpIntoLevel,
    xpNeededThisLevel: XP_PER_LEVEL,
    overallAccuracyPct,
    status,
    statusLabel,
  };
}

export function comboFromStreak(streak: number): SessionMomentum["combo"] {
  if (streak >= 7) return "Precision";
  if (streak >= 4) return "Locked In";
  if (streak >= 2) return "Building";
  return "Cold";
}

export function createMomentum(total: number): SessionMomentum {
  return {
    answered: 0,
    total,
    progressPct: 0,
    currentStreak: 0,
    bestStreak: 0,
    energy: STARTING_ENERGY,
    combo: "Cold",
    sessionXp: 0,
    instantXp: 0,
    lastResult: null,
  };
}

export function applyMomentumAnswer(
  prev: SessionMomentum,
  args: { correct: boolean; difficultyLevel?: number | null }
): SessionMomentum {
  const difficulty = safeNumber(args.difficultyLevel, 0);
  const nextAnswered = clamp(prev.answered + 1, 0, Math.max(prev.total, 1));

  const nextStreak = args.correct ? prev.currentStreak + 1 : 0;
  const bestStreak = Math.max(prev.bestStreak, nextStreak);

  const baseXp = args.correct ? 18 : 6;
  const difficultyXp = args.correct ? (difficulty >= 4 ? 5 : difficulty >= 3 ? 3 : 1) : 0;
  const streakXp = args.correct ? clamp(nextStreak - 1, 0, 8) : 0;
  const instantXp = baseXp + difficultyXp + streakXp;

  const energyDelta = args.correct ? 8 + clamp(Math.floor(nextStreak / 2), 0, 6) : -12;

  const energy = clamp(prev.energy + energyDelta, 0, 100);
  const progressPct = clamp(Math.round((nextAnswered / Math.max(prev.total, 1)) * 100), 0, 100);

  return {
    answered: nextAnswered,
    total: prev.total,
    progressPct,
    currentStreak: nextStreak,
    bestStreak,
    energy,
    combo: comboFromStreak(nextStreak),
    sessionXp: prev.sessionXp + instantXp,
    instantXp,
    lastResult: args.correct ? "correct" : "incorrect",
  };
}

export function pointsToNextDivision(identity: EngagementIdentity): number {
  const next = getNextDivision(identity.lifetimeXp);
  if (!next) return 0;
  return Math.max(0, next.minXp - identity.lifetimeXp);
}

export function createShareText(args: {
  nickname: string;
  mode: SessionMode;
  correct: number;
  answered: number;
  accuracyPct: number;
  streakDays: number;
  level: number;
  division: string;
}): string {
  return [
    `${args.nickname} just finished a ${args.mode} block on ALGA.`,
    `${args.correct}/${args.answered} correct (${args.accuracyPct}%).`,
    `Streak: ${args.streakDays}d • ${args.division} L${args.level}.`,
    "Your move: run a 12-question SAT block and post your result.",
  ].join(" ");
}
