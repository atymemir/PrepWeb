import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveLesson } from "@/app/lib/lessonResolver";
import { mathLessonToolContext } from "@/app/lib/mathToolContext";

export default function LessonPage({ params }: { params: { subskill: string } }) {
  const lesson = resolveLesson(params.subskill);

  if (!lesson) {
    notFound();
  }
  const toolContext = mathLessonToolContext(lesson);

  return (
    <main className="min-h-screen">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {lesson.subject ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
              {lesson.subject}
            </span>
          ) : null}

          {lesson.domain ? (
            <span className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
              {lesson.domain}
            </span>
          ) : null}
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{lesson.title}</h1>

        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
          {lesson.summary}
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 p-5">
            <div className="text-sm font-semibold text-black">Key points</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
              {lesson.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 p-5">
            <div className="text-sm font-semibold text-black">Common traps</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
              {lesson.commonTraps.map((trap, i) => (
                <li key={i}>{trap}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-black">Mini example</div>

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
            Prompt
          </div>
          <div className="mt-1 whitespace-pre-line text-sm text-gray-700">
            {lesson.miniExample.prompt}
          </div>

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
            Answer
          </div>
          <div className="mt-1 whitespace-pre-line text-sm text-gray-700">
            {lesson.miniExample.answer}
          </div>
        </div>

        {toolContext && (
          <div className="mt-4 rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              SAT math execution for this topic
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#b7d2ff] bg-white p-3">
                <div className="text-xs font-semibold text-[#004aad]">Formula now</div>
                <div className="mt-1 text-sm font-semibold text-black">{toolContext.formula.name}</div>
                <div className="mt-1 text-xs text-gray-700">{toolContext.formula.formula}</div>
              </div>
              <div className="rounded-xl border border-[#b7d2ff] bg-white p-3">
                <div className="text-xs font-semibold text-[#004aad]">Calculator helps when</div>
                <div className="mt-1 text-sm font-semibold text-black">{toolContext.calculatorTip.title}</div>
                <div className="mt-1 text-xs text-gray-700">{toolContext.calculatorTip.quickRule}</div>
              </div>
              <div className="rounded-xl border border-[#b7d2ff] bg-white p-3">
                <div className="text-xs font-semibold text-[#004aad]">Fast SAT move</div>
                <div className="mt-1 text-sm text-gray-800">{toolContext.fastMove}</div>
              </div>
              <div className="rounded-xl border border-[#b7d2ff] bg-white p-3">
                <div className="text-xs font-semibold text-[#004aad]">Algebra is faster when</div>
                <div className="mt-1 text-sm text-gray-800">{toolContext.algebraFasterWhen}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/practice?subject=${lesson.subject ?? "Reading"}&subskill=${encodeURIComponent(lesson.key)}`}
            className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Practice this
          </Link>

          <Link
            href="/lessons"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-50"
          >
            Back to lessons
          </Link>
        </div>
      </div>
    </main>
  );
}
