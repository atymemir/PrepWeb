import type { EngagementIdentity, EngagementStatus, SessionMomentum, SessionPayoff } from "../lib/engagement";
import { Pill } from "../ui/ui";

function statusTone(status: EngagementStatus["status"]): "neutral" | "accent" | "success" {
  if (status === "sharp") return "success";
  if (status === "stable") return "accent";
  return "neutral";
}

export function IdentityStatusCard({
  identity,
  status,
  title,
  subtitle,
  note,
}: {
  identity: EngagementIdentity;
  status: EngagementStatus;
  title: string;
  subtitle: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#c7dbff] bg-[#f8fbff] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label label-accent">{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-black">{subtitle}</div>
          {note ? <div className="mt-2 text-sm leading-relaxed text-gray-700">{note}</div> : null}
        </div>
        <Pill text={status.statusLabel} tone={statusTone(status.status)} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-600">Daily streak</div>
          <div className="mt-1 text-2xl font-semibold text-black">{identity.streakDays}d</div>
          <div className="mt-1 text-xs text-gray-500">Best {identity.bestStreakDays}d</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-600">Division</div>
          <div className="mt-1 text-2xl font-semibold text-black">{status.division.label}</div>
          <div className="mt-1 text-xs text-gray-500">Level {status.level}</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-600">Lifetime XP</div>
          <div className="mt-1 text-2xl font-semibold text-black">{identity.lifetimeXp}</div>
          <div className="mt-1 text-xs text-gray-500">{identity.totalSessions} sessions logged</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-600">Overall accuracy</div>
          <div className="mt-1 text-2xl font-semibold text-black">{status.overallAccuracyPct}%</div>
          <div className="mt-1 text-xs text-gray-500">Across all recorded sessions</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-600">
            <span>Level progress</span>
            <span>
              {status.xpIntoLevel}/{status.xpNeededThisLevel} XP
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#004aad]"
              style={{ width: `${status.levelProgressPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-600">
            <span>Division progress</span>
            <span>{status.nextDivision ? `To ${status.nextDivision.label}` : "Top division"}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-black"
              style={{ width: `${status.divisionProgressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MomentumRail({
  momentum,
  title,
  subtitle,
}: {
  momentum: SessionMomentum;
  title: string;
  subtitle: string;
}) {
  const comboTone =
    momentum.combo === "Precision"
      ? "success"
      : momentum.combo === "Locked In"
      ? "accent"
      : "neutral";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-black">{title}</div>
          <div className="mt-1 text-xs text-gray-600">{subtitle}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill text={`Combo: ${momentum.combo}`} tone={comboTone} />
          <Pill text={`+${momentum.instantXp} XP`} tone={momentum.lastResult === "correct" ? "success" : "neutral"} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-600">
            <span>Progress</span>
            <span>
              {momentum.answered}/{momentum.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#004aad]"
              style={{ width: `${momentum.progressPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-600">
            <span>Energy</span>
            <span>{momentum.energy}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-black"
              style={{ width: `${momentum.energy}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          Streak: <span className="font-semibold text-black">{momentum.currentStreak}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          Best: <span className="font-semibold text-black">{momentum.bestStreak}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          Session XP: <span className="font-semibold text-black">{momentum.sessionXp}</span>
        </div>
      </div>
    </div>
  );
}

export function SessionPayoffCard({
  payoff,
  status,
  streakDays,
  mode,
}: {
  payoff: SessionPayoff;
  status: EngagementStatus;
  streakDays: number;
  mode: "practice" | "review";
}) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-[#c7dbff] bg-[#f6faff] p-5">
      <div className="label label-accent">Session payoff</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-black">+{payoff.totalAwarded} XP</div>
      <div className="mt-2 text-sm text-gray-700">
        {mode === "practice"
          ? "Practice payoff reflects execution quality and completion discipline."
          : "Review payoff reflects recovery quality and completion discipline."}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Server-verified progression record.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
          Base: <span className="font-semibold text-black">{payoff.baseXp}</span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
          Completion: <span className="font-semibold text-black">{payoff.completionBonus}</span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
          Accuracy: <span className="font-semibold text-black">{payoff.accuracyBonus}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        Identity update: <span className="font-semibold text-black">{status.division.label}</span> • Level {status.level}
        <span className="mx-2 text-gray-400">|</span>
        Streak <span className="font-semibold text-black">{streakDays}d</span>
      </div>
    </div>
  );
}
