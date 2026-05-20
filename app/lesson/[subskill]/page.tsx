'use client';
export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { LESSONS } from '@/app/data/lessons';
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from '@/app/ui/ui';

export default function LessonPage() {
  const params = useParams<{ subskill: string }>();
  const subskill = decodeURIComponent(params.subskill);

  const lesson = useMemo(() => {
    return LESSONS.find((l) => l.key.toLowerCase() === subskill.toLowerCase()) || null;
  }, [subskill]);

  return (
    <main className="min-h-screen">
      <PageHeader title={subskill} subtitle="Lesson notes + traps + mini example" />

      {!lesson ? (
        <Card title="Lesson not available yet" subtitle="This topic doesn’t have written notes yet.">
          <div className="text-sm text-gray-700">
            You can still practice the topic now. Later we’ll add notes here.
          </div>
          <div className="mt-5 grid gap-3">
            <PrimaryButton href={`/practice?subject=Reading&subskill=${encodeURIComponent(subskill)}`}>
              Practice this (12Q)
            </PrimaryButton>
            <SecondaryButton href="/skills">Back to skills</SecondaryButton>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card title="Summary" subtitle={lesson.title}>
            <div className="text-sm text-gray-800 leading-relaxed">{lesson.summary}</div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Pill text="Short" />
              <Pill text="Practical" />
              <Pill text="SAT-style" />
            </div>
          </Card>

          <Card title="Key points">
            <ul className="list-disc pl-5 text-sm text-gray-800 space-y-2">
              {lesson.keyPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </Card>

          <Card title="Common traps">
            <ul className="list-disc pl-5 text-sm text-gray-800 space-y-2">
              {lesson.commonTraps.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </Card>

          <Card title="Mini example">
            <div className="text-sm text-gray-800">
              <div className="font-semibold">Prompt</div>
              <div className="mt-1 text-gray-700">{lesson.miniExample.prompt}</div>

              <div className="mt-4 font-semibold">Answer</div>
              <div className="mt-1 text-gray-700">{lesson.miniExample.answer}</div>
            </div>

            <div className="mt-5 grid gap-3">
              <PrimaryButton href={`/practice?subject=Reading&subskill=${encodeURIComponent(subskill)}`}>
                Practice this (12Q)
              </PrimaryButton>
              <SecondaryButton href="/skills">Back to skills</SecondaryButton>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
