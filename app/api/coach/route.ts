import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAiRateLimit } from "@/app/lib/aiRateLimit";
import { getUserFromAccessToken } from "@/app/lib/serverTokenAuth";
import { normalizePlanTier, tierDefinition } from "@/app/lib/productTiers";

type WeakArea = {
  subject: "Reading" | "Math";
  subskill: string;
  domain: string;
  skill: string;
  attempts: number;
  accuracy: number;
};

type CoachSnapshot = {
  nickname: string;
  examCountdownDays: number | null;
  dueReviewCount: number;
  weeklyRank: number | null;
  weeklyPoints: number | null;
  stableWeakAreas: WeakArea[];
  lowSignalCount: number;
  nextAction: {
    title: string;
    description: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref: string;
    secondaryLabel: string;
  };
};

function isValidWeakArea(x: any): x is WeakArea {
  return (
    x &&
    (x.subject === "Reading" || x.subject === "Math") &&
    typeof x.subskill === "string" &&
    typeof x.domain === "string" &&
    typeof x.skill === "string" &&
    typeof x.attempts === "number" &&
    typeof x.accuracy === "number"
  );
}

function isValidSnapshot(x: any): x is CoachSnapshot {
  return (
    x &&
    typeof x.nickname === "string" &&
    (typeof x.examCountdownDays === "number" || x.examCountdownDays === null) &&
    typeof x.dueReviewCount === "number" &&
    (typeof x.weeklyRank === "number" || x.weeklyRank === null) &&
    (typeof x.weeklyPoints === "number" || x.weeklyPoints === null) &&
    Array.isArray(x.stableWeakAreas) &&
    x.stableWeakAreas.every(isValidWeakArea) &&
    typeof x.lowSignalCount === "number" &&
    x.nextAction &&
    typeof x.nextAction.title === "string" &&
    typeof x.nextAction.description === "string" &&
    typeof x.nextAction.primaryHref === "string" &&
    typeof x.nextAction.primaryLabel === "string" &&
    typeof x.nextAction.secondaryHref === "string" &&
    typeof x.nextAction.secondaryLabel === "string"
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const { user, token, error: authError } = await getUserFromAccessToken(
      req.headers.get("authorization")
    );

    if (!user || !token) {
      return NextResponse.json({ error: authError || "Unauthorized." }, { status: 401 });
    }

    let planTier = "free";
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("id", user.id)
        .single();

      if (!profileErr) {
        planTier = normalizePlanTier((profileRow as { plan_tier?: string | null })?.plan_tier ?? "free");
      }
    } catch {
      planTier = "free";
    }

    const tier = tierDefinition(planTier);

    if (!tier.limits.coachAi) {
      return NextResponse.json(
        {
          error: "Coach strategist is available on Pro and Ultimate tiers.",
          tier: planTier,
        },
        { status: 403 }
      );
    }

    const limiter = checkAiRateLimit(
      `coach:${planTier}:${user.id}`,
      tier.limits.coachRateLimitPer10Min,
      10 * 60 * 1000
    );
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a few minutes." },
        { status: 429 }
      );
    }

    const raw = await req.json();
    if (!isValidSnapshot(raw)) {
      return NextResponse.json({ error: "Invalid coach snapshot." }, { status: 400 });
    }

    const snapshot: CoachSnapshot = {
      ...raw,
      nickname: raw.nickname.slice(0, 80),
      stableWeakAreas: raw.stableWeakAreas.slice(0, 5).map((item) => ({
        ...item,
        subskill: item.subskill.slice(0, 120),
        domain: item.domain.slice(0, 120),
        skill: item.skill.slice(0, 120),
      })),
      nextAction: {
        ...raw.nextAction,
        title: raw.nextAction.title.slice(0, 120),
        description: raw.nextAction.description.slice(0, 300),
        primaryHref: raw.nextAction.primaryHref.slice(0, 200),
        primaryLabel: raw.nextAction.primaryLabel.slice(0, 80),
        secondaryHref: raw.nextAction.secondaryHref.slice(0, 200),
        secondaryLabel: raw.nextAction.secondaryLabel.slice(0, 80),
      },
    };

    const systemPrompt = `
You are the strategist layer for a Digital SAT training product called alga.

Your job:
- interpret structured SAT training data
- explain what matters now
- give concise, practical guidance
- never invent facts not present in the snapshot
- never predict SAT score gains
- never diagnose medical, psychological, or personal conditions
- do not use hype, therapy tone, or vague motivation
- write like a sharp strategist, not a chatbot

Return strict JSON with this shape:
{
  "coach_note_title": string,
  "coach_note_body": string,
  "top_issues": [
    { "title": string, "detail": string },
    { "title": string, "detail": string },
    { "title": string, "detail": string }
  ],
  "three_step_plan": [
    { "step": "1", "title": string, "detail": string },
    { "step": "2", "title": string, "detail": string },
    { "step": "3", "title": string, "detail": string }
  ],
  "tone_label": "Focused" | "Urgent" | "Rebuild" | "Advance"
}

Rules:
- Use only the provided snapshot.
- Make the advice specific to the data.
- Prefer concrete route logic over generic study advice.
- If dueReviewCount > 0, recovery should dominate the note.
- If stableWeakAreas are present, mention the most important one.
- If lowSignalCount is high, mention uncertainty and sample-size caution.
- Keep each field short and tight.
`.trim();

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions: systemPrompt,
      input: JSON.stringify(snapshot),
      reasoning: {
        effort: "low",
      },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "coach_strategy",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              coach_note_title: { type: "string" },
              coach_note_body: { type: "string" },
              top_issues: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                  },
                  required: ["title", "detail"],
                },
              },
              three_step_plan: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    step: { type: "string", enum: ["1", "2", "3"] },
                    title: { type: "string" },
                    detail: { type: "string" },
                  },
                  required: ["step", "title", "detail"],
                },
              },
              tone_label: {
                type: "string",
                enum: ["Focused", "Urgent", "Rebuild", "Advance"],
              },
            },
            required: [
              "coach_note_title",
              "coach_note_body",
              "top_issues",
              "three_step_plan",
              "tone_label",
            ],
          },
        },
      },
    });

    return NextResponse.json(JSON.parse(response.output_text));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Coach generation failed." },
      { status: 500 }
    );
  }
}
