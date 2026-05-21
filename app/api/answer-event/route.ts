import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromAccessToken } from "@/app/lib/serverTokenAuth";

type AnswerEventPayload = {
  question_id: string;
  selected_option: string;
  is_review: boolean;
  time_taken_seconds: number;
};

function isValidPayload(x: any): x is AnswerEventPayload {
  return (
    x &&
    typeof x.question_id === "string" &&
    /^[ABCD]$/i.test(x.selected_option) &&
    typeof x.is_review === "boolean" &&
    typeof x.time_taken_seconds === "number" &&
    Number.isFinite(x.time_taken_seconds)
  );
}

function clampTime(seconds: number) {
  return Math.max(0, Math.min(Math.round(seconds), 60 * 60));
}

export async function POST(req: NextRequest) {
  try {
    const { user, token, error: authError } = await getUserFromAccessToken(
      req.headers.get("authorization")
    );

    if (!user || !token) {
      return NextResponse.json({ error: authError || "Unauthorized." }, { status: 401 });
    }

    const raw = await req.json();
    if (!isValidPayload(raw)) {
      return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });
    }

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

    const questionRes = await supabase
      .from("questions")
      .select("id,correct_option")
      .eq("id", raw.question_id)
      .single();

    if (questionRes.error || !questionRes.data?.correct_option) {
      return NextResponse.json(
        { error: questionRes.error?.message || "Question not found." },
        { status: 404 }
      );
    }

    const selectedOpt = raw.selected_option.toUpperCase();
    const correctOpt = String(questionRes.data.correct_option).toUpperCase();
    const isCorrect = selectedOpt === correctOpt;
    const timeTaken = clampTime(raw.time_taken_seconds);

    const secureRecordRes = await supabase.rpc("record_answer_event_secure", {
      p_question_id: raw.question_id,
      p_selected_option: selectedOpt,
      p_is_review: raw.is_review,
      p_time_taken_seconds: timeTaken,
    });

    if (secureRecordRes.error) {
      const canFallback =
        secureRecordRes.error.code === "PGRST202" ||
        secureRecordRes.error.message.toLowerCase().includes("record_answer_event_secure");

      if (!canFallback) {
        return NextResponse.json({ error: secureRecordRes.error.message }, { status: 500 });
      }

      const recordRes = await supabase.rpc("record_answer_event", {
        p_question_id: raw.question_id,
        p_selected_option: selectedOpt,
        p_is_correct: isCorrect,
        p_is_review: raw.is_review,
        p_time_taken_seconds: timeTaken,
      });

      if (recordRes.error) {
        return NextResponse.json({ error: recordRes.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      question_id: raw.question_id,
      selected_option: selectedOpt,
      correct_option: correctOpt,
      is_correct: isCorrect,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to record answer." },
      { status: 500 }
    );
  }
}
