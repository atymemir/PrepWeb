'use client';

import Link from "next/link";
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
  const subjectParam = subject === "Math" ? "Math" : "Reading";
  const lessonHref = subskill ? `/lesson/${encodeURIComponent(subskill)}` : null;
  const retryHref = subskill
    ? `/practice?subject=${subjectParam}&subskill=${encodeURIComponent(subskill)}&revisit=1`
    : `/practice?subject=${subjectParam}`;

  return (
    <>
      {contextLine && (
        <div className="mt-3 text-xs font-semibold uppercase text-gray-500">
          {contextLine}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {lessonHref && (
          <Link
            href={lessonHref}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#0f172a] transition hover:border-gray-400 hover:bg-gray-50"
          >
            Repair lesson
          </Link>
        )}
        <Link
          href={retryHref}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#0f172a] transition hover:border-gray-400 hover:bg-gray-50"
        >
          Focused retry
        </Link>
        <button
          onClick={onExplain}
          disabled={aiExplainLoading}
          className="inline-flex items-center justify-center rounded-lg border border-[#c7dbff] bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#004aad] transition hover:bg-[#dfeeff] disabled:opacity-60"
        >
          {aiExplainLoading
            ? "Generating..."
            : aiExplain
            ? "Refresh AI"
            : "Explain"}
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
