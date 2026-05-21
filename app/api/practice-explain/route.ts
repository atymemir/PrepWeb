import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { checkAiRateLimit } from "@/app/lib/aiRateLimit";
import { getUserFromAccessToken } from "@/app/lib/serverTokenAuth";

type PracticeExplainPayload = {
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

function isValidPayload(x: any): x is PracticeExplainPayload {
  return (
    x &&
    typeof x.subject === "string" &&
    typeof x.question_text === "string" &&
    typeof x.option_a === "string" &&
    typeof x.option_b === "string" &&
    typeof x.option_c === "string" &&
    typeof x.option_d === "string" &&
    typeof x.correct_option === "string" &&
    typeof x.selected_option === "string" &&
    (typeof x.subskill === "string" || x.subskill === null || typeof x.subskill === "undefined") &&
    (typeof x.explanation === "string" || x.explanation === null || typeof x.explanation === "undefined")
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization");
    const { user, error: authError } = await getUserFromAccessToken(authHeader);

    if (!user) {
      return NextResponse.json({ error: authError || "Unauthorized." }, { status: 401 });
    }

    const limiter = checkAiRateLimit(`practice-explain:${user.id}`, 20, 10 * 60 * 1000);
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a few minutes." },
        { status: 429 }
      );
    }

    const raw = await req.json();

    if (!isValidPayload(raw)) {
      return NextResponse.json({ error: "Invalid explanation payload." }, { status: 400 });
    }

    const body: PracticeExplainPayload = {
      subject: raw.subject.slice(0, 40),
      subskill: raw.subskill ? raw.subskill.slice(0, 120) : null,
      question_text: raw.question_text.slice(0, 5000),
      option_a: raw.option_a.slice(0, 1000),
      option_b: raw.option_b.slice(0, 1000),
      option_c: raw.option_c.slice(0, 1000),
      option_d: raw.option_d.slice(0, 1000),
      correct_option: raw.correct_option.slice(0, 10),
      selected_option: raw.selected_option.slice(0, 10),
      explanation: raw.explanation ? raw.explanation.slice(0, 2000) : null,
    };

    const systemPrompt = `
You are an SAT explanation assistant inside a product called alga.

Your job:
- explain why the correct answer is right
- explain why the user's chosen answer was tempting or wrong
- explain the trap pattern briefly
- keep it concise, useful, and grounded in the provided question only
- do not invent missing graphs or passage details
- do not be verbose
- do not use hype or motivation language

Return strict JSON:
{
  "why_correct": string,
  "why_user_missed": string,
  "trap_pattern": string,
  "how_to_avoid": string
}
`.trim();

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      instructions: systemPrompt,
      input: JSON.stringify(body),
      reasoning: {
        effort: "low",
      },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "practice_explanation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              why_correct: { type: "string" },
              why_user_missed: { type: "string" },
              trap_pattern: { type: "string" },
              how_to_avoid: { type: "string" },
            },
            required: ["why_correct", "why_user_missed", "trap_pattern", "how_to_avoid"],
          },
        },
      },
    });

    return NextResponse.json(JSON.parse(response.output_text));
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate explanation." },
      { status: 500 }
    );
  }
}
