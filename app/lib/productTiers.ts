export type PlanTier = "free" | "pro" | "ultimate";

export type TierDefinition = {
  key: PlanTier;
  label: string;
  tagline: string;
  monthlyUsd: number;
  yearlyUsd: number;
  includes: string[];
  limits: {
    examMode: boolean;
    coachAi: boolean;
    coachRateLimitPer10Min: number;
    historySessionLimit: number;
    advancedHistoryInsights: boolean;
  };
};

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    key: "free",
    label: "Free",
    tagline: "Core SAT loop, no fluff.",
    monthlyUsd: 0,
    yearlyUsd: 0,
    includes: [
      "Core loop: Practice, Review, Skills, Lessons",
      "Fresh vs revisit practice routing",
      "Session history (recent window)",
      "SAT tools reference layer",
    ],
    limits: {
      examMode: false,
      coachAi: false,
      coachRateLimitPer10Min: 0,
      historySessionLimit: 25,
      advancedHistoryInsights: false,
    },
  },
  {
    key: "pro",
    label: "Pro",
    tagline: "Execution depth for serious prep.",
    monthlyUsd: 24,
    yearlyUsd: 19,
    includes: [
      "Everything in Free",
      "Exam mode with SAT-like shell",
      "Replay + revise history depth",
      "AI Coach strategist layer",
    ],
    limits: {
      examMode: true,
      coachAi: true,
      coachRateLimitPer10Min: 5,
      historySessionLimit: 160,
      advancedHistoryInsights: true,
    },
  },
  {
    key: "ultimate",
    label: "Ultimate",
    tagline: "Maximum depth and feedback velocity.",
    monthlyUsd: 49,
    yearlyUsd: 39,
    includes: [
      "Everything in Pro",
      "Higher AI coach throughput",
      "Deeper history trend windows",
      "Priority advanced analytics rollouts",
    ],
    limits: {
      examMode: true,
      coachAi: true,
      coachRateLimitPer10Min: 10,
      historySessionLimit: 420,
      advancedHistoryInsights: true,
    },
  },
];

const BY_TIER = new Map<PlanTier, TierDefinition>(
  TIER_DEFINITIONS.map((tier) => [tier.key, tier])
);

export function normalizePlanTier(input: string | null | undefined): PlanTier {
  if (input === "pro") return "pro";
  if (input === "ultimate") return "ultimate";
  return "free";
}

export function tierDefinition(tier: string | null | undefined): TierDefinition {
  const key = normalizePlanTier(tier);
  return BY_TIER.get(key)!;
}

export function tierTone(tier: string | null | undefined): "neutral" | "accent" | "success" {
  const key = normalizePlanTier(tier);
  if (key === "ultimate") return "success";
  if (key === "pro") return "accent";
  return "neutral";
}

export function isPaidTier(tier: string | null | undefined): boolean {
  const key = normalizePlanTier(tier);
  return key === "pro" || key === "ultimate";
}

