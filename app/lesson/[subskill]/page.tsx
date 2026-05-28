import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { resolveLesson } from "@/app/lib/lessonResolver";
import { mathLessonToolContext } from "@/app/lib/mathToolContext";

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#d7e7ff]">
      {children}
    </span>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c9dcfb] bg-[#eef5ff] text-xs font-bold text-[#004aad]">
            {index + 1}
          </div>
          <div className="pt-1 text-sm leading-relaxed text-gray-700">{item}</div>
        </div>
      ))}
    </div>
  );
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ subskill: string }>;
}) {
  const { subskill } = await params;
  const lesson = resolveLesson(subskill);

  if (!lesson) {
    notFound();
  }

  const toolContext = mathLessonToolContext(lesson);
  const practiceHref = `/practice?subject=${lesson.subject}&subskill=${encodeURIComponent(lesson.key)}&revisit=1`;

  return (
    <main className="min-h-screen">
      <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Chip>{lesson.subject}</Chip>
              <Chip>{lesson.domain}</Chip>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {lesson.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#d2dbec]">
              {lesson.summary}
            </p>
            <div className="mt-6 grid gap-3 sm:max-w-xl sm:grid-cols-2">
              <Link
                href={practiceHref}
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0e1b34] transition hover:bg-[#ecf3ff]"
              >
                Practice this
              </Link>
              <Link
                href="/lessons"
                className="inline-flex items-center justify-center rounded-xl border border-[#506894] bg-white/5 px-4 py-3 text-sm font-semibold text-[#d7e3fb] transition hover:border-[#6f8ec7] hover:bg-white/10"
              >
                Lesson library
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">
                Repair cue
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[#d8e4fb]">{lesson.practiceCue}</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">
                SAT move
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[#d8e4fb]">{lesson.satMoves[0]}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Repair pattern
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
            How to recover this subskill
          </h2>
          <div className="mt-5">
            <NumberedList items={lesson.repairPattern} />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Decision rules
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
            What to check under time
          </h2>
          <div className="mt-5 grid gap-3">
            {lesson.decisionRules.map((rule) => (
              <div key={rule} className="rounded-2xl border border-[#d7e5fb] bg-[#f6faff] px-4 py-3 text-sm leading-relaxed text-gray-800">
                {rule}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              Common traps
            </div>
            <div className="mt-4 grid gap-2">
              {lesson.commonTraps.map((trap) => (
                <div key={trap} className="rounded-2xl border border-[#f2c7cf] bg-[#fff5f7] px-4 py-3 text-sm text-[#8f1d35]">
                  {trap}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              SAT moves
            </div>
            <div className="mt-4 grid gap-2">
              {lesson.satMoves.map((move) => (
                <div key={move} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                  {move}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-[#c7dbff] bg-[#f6faff] p-5 shadow-sm sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Micro-drill
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
              Prove the pattern once
            </h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-800">
              {lesson.microDrill.prompt}
            </div>
            <div className="mt-5">
              <NumberedList items={lesson.microDrill.steps} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#b7d2ff] bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Answer
            </div>
            <div className="mt-3 text-sm leading-relaxed text-gray-800">{lesson.microDrill.answer}</div>

            <div className="mt-5 border-t border-gray-200 pt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Mini example
              </div>
              <div className="mt-2 text-sm leading-relaxed text-gray-700">{lesson.miniExample.prompt}</div>
              <div className="mt-3 text-sm font-semibold text-[#0f172a]">{lesson.miniExample.answer}</div>
            </div>
          </div>
        </div>
      </section>

      {toolContext && (
        <section className="mt-5 rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Math execution layer
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Formula</div>
              <div className="mt-2 text-sm font-semibold text-black">{toolContext.formula.name}</div>
              <div className="mt-1 text-xs text-gray-700">{toolContext.formula.formula}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Calculator</div>
              <div className="mt-2 text-sm font-semibold text-black">{toolContext.calculatorTip.title}</div>
              <div className="mt-1 text-xs text-gray-700">{toolContext.calculatorTip.quickRule}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Fast move</div>
              <div className="mt-2 text-sm text-gray-800">{toolContext.fastMove}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold text-gray-500">Use algebra when</div>
              <div className="mt-2 text-sm text-gray-800">{toolContext.algebraFasterWhen}</div>
            </div>
          </div>
        </section>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link
          href={practiceHref}
          className="inline-flex items-center justify-center rounded-xl bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2b4a]"
        >
          Run targeted practice
        </Link>
        <Link
          href="/review"
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50"
        >
          Open review
        </Link>
        <Link
          href="/history"
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50"
        >
          Replay history
        </Link>
      </div>
    </main>
  );
}
