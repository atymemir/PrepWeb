import { notFound } from "next/navigation";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "../../ui/ui";
import { LESSONS } from "../../data/lessons";

export default function LessonPage({ params }: { params: { subskill: string } }) {
  const lesson = LESSONS.find((lesson) => lesson.key === params.subskill);

  if (!lesson) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <PageHeader
        title={lesson.title}
        subtitle={lesson.summary}
        right={<Pill text={lesson.key} />}
      />

      <div className="space-y-6">
        <Card title="Key points">
          <ul className="space-y-3 text-sm text-gray-700">
            {lesson.keyPoints.map((point, index) => (
              <li key={index} className="list-disc pl-5">
                {point}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Common traps">
          <ul className="space-y-3 text-sm text-gray-700">
            {lesson.commonTraps.map((trap, index) => (
              <li key={index} className="list-disc pl-5">
                {trap}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Mini example">
          <div className="space-y-3 text-sm text-gray-700">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="font-semibold text-black">Prompt</div>
              <div className="mt-2 whitespace-pre-wrap">{lesson.miniExample.prompt}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="font-semibold text-black">Answer</div>
              <div className="mt-2 whitespace-pre-wrap">{lesson.miniExample.answer}</div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <PrimaryButton href={`/practice?subskill=${encodeURIComponent(lesson.key)}`}>
            Practice this subskill
          </PrimaryButton>
          <SecondaryButton href="/skills">Back to Skills</SecondaryButton>
        </div>
      </div>
    </main>
  );
}
