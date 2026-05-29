import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { resolveLesson } from "@/app/lib/lessonResolver";
import { focusedPracticeHref } from "@/app/lib/mastery";
import { mathLessonToolContext } from "@/app/lib/mathToolContext";

const CORE_REPAIR_LESSONS = new Set([
  "Words in Context",
  "Text Structure and Purpose",
  "Inferences",
  "Command of Evidence",
  "Boundaries",
  "Linear Equations in One Variable",
  "Functions and Notation",
  "Ratios, Rates, and Percent",
]);

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

function firstItem(items: string[]): string {
  return items.find((item) => item.trim().length > 0) ?? "";
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
  const practiceHref = `${focusedPracticeHref(lesson.subject, lesson.key)}&mode=trainer`;
  const quickPlaybook = lesson.repairPlaybook ?? {
    tests: firstItem(lesson.keyPoints),
    trap: firstItem(lesson.commonTraps),
    decisionRule: firstItem(lesson.decisionRules),
    fastMove: firstItem(lesson.satMoves),
    drillNow: lesson.microDrill.prompt,
    retryPayoff: lesson.practiceCue,
  };
  const isCoreRepairLesson = CORE_REPAIR_LESSONS.has(lesson.key);

  return (
    <main className="min-h-screen">
      <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] shadow-xl">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Chip>{lesson.subject}</Chip>
              <Chip>{lesson.domain}</Chip>
              {isCoreRepairLesson && <Chip>Core repair lesson</Chip>}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {lesson.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#d2dbec]">
              {lesson.summary}
            </p>
            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#9ab8ec]">
              Repair first, then run focused retry from the action block below.
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">
                Why this repair now
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[#d8e4fb]">{lesson.practiceCue}</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">
                Session payoff
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[#d8e4fb]">{quickPlaybook.retryPayoff}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
          Repair playbook snapshot
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
          Read this once, then execute
        </h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#d9e6fc] bg-[#f8fbff]">
          <div className="grid gap-0">
            <div className="grid gap-2 border-b border-[#d9e6fc] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Skill test</div>
              <div className="text-sm text-gray-800">{quickPlaybook.tests}</div>
            </div>
            <div className="grid gap-2 border-b border-[#d9e6fc] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f1d35]">Trap</div>
              <div className="text-sm text-gray-800">{quickPlaybook.trap}</div>
            </div>
            <div className="grid gap-2 border-b border-[#d9e6fc] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Decision rule</div>
              <div className="text-sm text-gray-800">{quickPlaybook.decisionRule}</div>
            </div>
            <div className="grid gap-2 border-b border-[#d9e6fc] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Fast SAT move</div>
              <div className="text-sm text-gray-800">{quickPlaybook.fastMove}</div>
            </div>
            <div className="grid gap-2 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Payoff if cleared</div>
              <div className="text-sm text-gray-800">{quickPlaybook.retryPayoff}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Repair playbook
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
            Do this in order under time
          </h2>
          <div className="mt-5">
            <NumberedList items={lesson.repairPattern} />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Micro-drill
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#0f172a]">
            Prove the pattern once right now
          </h2>
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-800">
            {lesson.microDrill.prompt}
          </div>
          <div className="mt-5 grid gap-3">
            <NumberedList items={lesson.microDrill.steps} />
          </div>
          <div className="mt-5 rounded-2xl border border-[#b7d2ff] bg-[#f6faff] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">Answer</div>
            <div className="mt-2 text-sm leading-relaxed text-gray-800">{lesson.microDrill.answer}</div>
          </div>
          <div className="mt-5 border-t border-gray-200 pt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Mini example</div>
            <div className="mt-2 text-sm leading-relaxed text-gray-700">{lesson.miniExample.prompt}</div>
            <div className="mt-3 text-sm font-semibold text-[#0f172a]">{lesson.miniExample.answer}</div>
          </div>
        </section>
      </div>

      {toolContext && (
        <section className="mt-5 rounded-3xl border border-gray-200 bg-white/92 p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Math execution layer
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Formula + fast move</div>
              <div className="mt-2 text-sm font-semibold text-black">{toolContext.formula.name}</div>
              <div className="mt-1 text-xs text-gray-700">{toolContext.formula.formula}</div>
              <div className="mt-3 text-sm text-gray-800">{toolContext.fastMove}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Calculator + algebra choice</div>
              <div className="mt-2 text-sm font-semibold text-black">{toolContext.calculatorTip.title}</div>
              <div className="mt-1 text-xs text-gray-700">{toolContext.calculatorTip.quickRule}</div>
              <div className="mt-3 text-sm text-gray-800">{toolContext.algebraFasterWhen}</div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-3xl border border-[#1f3458] bg-[#0e1b34] p-5 shadow-xl sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9ac0ff]">
          Return to focused retry
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Lock this repair while it is fresh</h2>
        <div className="mt-3 text-sm leading-relaxed text-[#d6e4ff]">{quickPlaybook.retryPayoff}</div>
        <div className="mt-5">
          <Link
            href={practiceHref}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0e1b34] transition hover:bg-[#ecf3ff]"
          >
            Start focused retry on {lesson.key}
          </Link>
        </div>
        <div className="mt-3">
          <Link href="/lessons" className="text-sm font-semibold text-[#b9d2ff] underline-offset-4 hover:underline">
            Back to lesson library
          </Link>
        </div>
      </section>
    </main>
  );
}
