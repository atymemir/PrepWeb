'use client';

import ReportQuestion from "./ReportQuestion";
import type { AiExplanation } from "../lib/questionExplanation";

type QuestionActionMode = "practice" | "review";

export default function QuestionActionBlock({
  mode,
  questionId,
  subject,
  subskill,
  onExplain,
  aiExplainLoading,
  aiExplainError,
  aiExplain,
  contextLine,
  footerNote,
}: {
  mode: QuestionActionMode;
  questionId: string;
  subject: string;
  subskill?: string;
  onExplain: () => void;
  aiExplainLoading: boolean;
  aiExplainError: string | null;
  aiExplain: AiExplanation | null;
  contextLine?: string;
  footerNote?: string;
}) {
  const reportSource = mode === "practice" ? "PracticeWeb" : "ReviewWeb";

  return (
    <>
      {contextLine && (
        <div className="mt-3 text-xs font-semibold uppercase text-gray-500">
          {contextLine}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onExplain}
          disabled={aiExplainLoading}
          className="rounded-lg border border-[#c7dbff] bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#004aad] transition hover:bg-[#dfeeff] disabled:opacity-60"
        >
          {aiExplainLoading
            ? "Generating AI explanation..."
            : aiExplain
            ? "Refresh AI explanation"
            : "Explain with AI"}
        </button>
      </div>

      {aiExplainError && (
        <div className="mt-3 text-sm text-red-600">{aiExplainError}</div>
      )}

      {aiExplain && (
        <div className="mt-4 rounded-xl border border-[#c7dbff] bg-[#f6faff] p-4">
          <div className="text-sm font-semibold text-[#004aad]">AI breakdown</div>
          <div className="mt-3 text-sm text-gray-800">
            <span className="font-semibold">Why the correct answer works:</span>{" "}
            {aiExplain.why_correct}
          </div>
          <div className="mt-3 text-sm text-gray-800">
            <span className="font-semibold">Why your choice missed:</span>{" "}
            {aiExplain.why_user_missed}
          </div>
          <div className="mt-3 text-sm text-gray-800">
            <span className="font-semibold">Trap pattern:</span>{" "}
            {aiExplain.trap_pattern}
          </div>
          <div className="mt-3 text-sm text-gray-800">
            <span className="font-semibold">How to avoid it next time:</span>{" "}
            {aiExplain.how_to_avoid}
          </div>
        </div>
      )}

      <ReportQuestion
        questionId={questionId}
        source={reportSource}
        subject={subject}
        subskill={subskill}
      />

      {footerNote && <div className="mt-4 text-xs text-gray-500">{footerNote}</div>}
    </>
  );
}
