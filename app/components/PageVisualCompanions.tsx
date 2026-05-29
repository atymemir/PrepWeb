import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TodayPressureCompanion({
  pressure,
  dueCount,
  weakAccuracy,
  movementDelta,
}: {
  pressure: "clear" | "light" | "moderate" | "heavy";
  dueCount: number;
  weakAccuracy: number | null;
  movementDelta: number | null;
}) {
  const pressureLabel = pressure === "heavy" ? "Heavy" : pressure === "moderate" ? "Moderate" : pressure === "light" ? "Light" : "Clear";
  const pressurePct = pressure === "heavy" ? 90 : pressure === "moderate" ? 68 : pressure === "light" ? 44 : 20;
  const focusPct = weakAccuracy === null ? 42 : clamp(100 - weakAccuracy, 12, 95);
  const deltaText = movementDelta === null ? "Pending movement" : `${movementDelta >= 0 ? "+" : ""}${movementDelta}% movement`;

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(140deg,#101c33,#172d4d_58%,#132947)] p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_180px_at_8%_12%,rgba(171,205,255,0.26),transparent_72%)]" />
      <div className="pointer-events-none absolute -right-14 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border border-white/20" />
      <div className="pointer-events-none absolute -right-4 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full border border-white/28" />

      <div className="relative z-[1] grid gap-4 lg:grid-cols-[1fr_10rem] lg:items-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#bbd4ff]">Live pressure field</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{dueCount} due now</div>
          <div className="mt-1 text-sm text-[#cad8f1]">{pressureLabel} review pressure • {deltaText}</div>

          <div className="mt-4 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#8eb8ff,#6697ea)]"
                style={{ width: `${pressurePct}%` }}
              />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#9fd5ff,#78b4f5)]"
                style={{ width: `${focusPct}%` }}
              />
            </div>
          </div>

          <div className="mt-3 text-[11px] text-[#c9d8f2]">
            Active weakness load: {weakAccuracy === null ? "pending" : `${weakAccuracy}% stability`}
          </div>
        </div>

        <div className="relative mx-auto h-36 w-36">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(rgba(162,201,255,0.95) 0deg ${Math.round((pressurePct / 100) * 320)}deg, rgba(255,255,255,0.12) ${Math.round((pressurePct / 100) * 320)}deg 360deg)`,
            }}
          />
          <div className="absolute inset-[18px] rounded-full bg-[#10213a]" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-xs text-[#b7cbed]">Focus</div>
              <div className="mt-1 text-xl font-semibold text-white">{focusPct}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PracticeAttackCompanion({
  modeLabel,
  targetLabel,
  minutes,
  questionCount,
  reviewDue,
}: {
  modeLabel: string;
  targetLabel: string;
  minutes: number;
  questionCount: number;
  reviewDue: number;
}) {
  const danger = reviewDue > 0;

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(144deg,#0f213e,#15375e_56%,#122f52)] p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_210px_at_80%_12%,rgba(165,204,255,0.28),transparent_72%)]" />

      <div className="relative z-[1] grid gap-4 lg:grid-cols-[1fr_12rem]">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#bed6ff]">Attack runway</div>
          <div className="mt-2 text-2xl font-semibold text-white">{modeLabel}</div>
          <div className="mt-1 text-sm text-[#ccdaf2]">Target lock: {targetLabel}</div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] text-[#d3e0f7]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#9ec2ff]" /> Prep
            </div>
            <div className="h-px flex-1 bg-white/25" />
            <div className="flex items-center gap-2 text-[11px] text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-white" /> Run
            </div>
            <div className="h-px flex-1 bg-white/25" />
            <div className="flex items-center gap-2 text-[11px] text-[#d3e0f7]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#9ec2ff]" /> Verify
            </div>
          </div>

          <div className="mt-4 text-[11px] text-[#c9d8f1]">
            {questionCount} questions • {minutes} minutes • review {danger ? `${reviewDue} due` : "clear"}
          </div>
        </div>

        <div className="relative mx-auto mt-1 h-32 w-32">
          <div className="absolute inset-0 rounded-full border border-white/20" />
          <div className="absolute inset-[14px] rounded-full border border-white/35" />
          <div className="absolute inset-[36px] rounded-full border border-white/55" />
          <div className="absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 bg-white/30" />
          <div className="absolute left-1/2 top-1/2 h-24 w-px -translate-x-1/2 -translate-y-1/2 bg-white/30" />
          <div className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${danger ? "bg-[#ffc2d1]" : "bg-[#c8e4ff]"}`} />
        </div>
      </div>
    </section>
  );
}

export function PracticePayoffCompanion({
  accuracy,
  delta,
  recovered,
  weakRemaining,
  reviewDue,
}: {
  accuracy: number;
  delta: number | null;
  recovered: number;
  weakRemaining: number;
  reviewDue: number;
}) {
  const deltaValue = delta === null ? 0 : clamp(delta, -30, 30);
  const arcPct = clamp(Math.round(accuracy), 8, 100);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(142deg,#10213a,#163150_58%,#17385a)] p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(360px_180px_at_15%_100%,rgba(166,202,255,0.24),transparent_72%)]" />

      <div className="relative z-[1] grid gap-4 lg:grid-cols-[9rem_1fr] lg:items-center">
        <div className="relative mx-auto h-32 w-32">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(rgba(162,201,255,0.95) 0deg ${Math.round((arcPct / 100) * 300)}deg, rgba(255,255,255,0.12) ${Math.round((arcPct / 100) * 300)}deg 360deg)`,
            }}
          />
          <div className="absolute inset-[16px] rounded-full bg-[#10213a]" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[10px] text-[#c5d6f0]">Accuracy</div>
              <div className="text-2xl font-semibold text-white">{accuracy}%</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#bdd5ff]">Momentum result</div>
          <svg viewBox="0 0 170 70" className="mt-2 h-20 w-full">
            <path d="M8 58 C36 40, 62 44, 92 33 C116 25, 138 34, 162 16" stroke="rgba(255,255,255,0.18)" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path
              d={`M8 58 C36 ${40 - deltaValue * 0.2}, 62 ${44 - deltaValue * 0.25}, 92 ${33 - deltaValue * 0.3} C116 ${25 - deltaValue * 0.2}, 138 ${34 - deltaValue * 0.25}, 162 ${16 - deltaValue * 0.35}`}
              stroke="#a8cbff"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-1 text-sm text-[#d0def4]">
            {delta === null ? "Baseline captured" : `Comparable movement ${delta >= 0 ? "+" : ""}${delta}%`}
          </div>
          <div className="mt-2 text-[11px] text-[#c5d4ef]">
            Recovered {recovered} • Weak left {weakRemaining} • Review {reviewDue > 0 ? `${reviewDue} due` : "clear"}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReviewRecoveryCompanion({
  totalDue,
  block,
  deferred,
  topReason,
  topTopic,
}: {
  totalDue: number;
  block: number;
  deferred: number;
  topReason: string | null;
  topTopic: string | null;
}) {
  const clearShare = totalDue <= 0 ? 0 : clamp(Math.round((block / totalDue) * 100), 8, 100);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(142deg,#12283c,#103544_55%,#124254)] p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(370px_180px_at_78%_14%,rgba(170,226,198,0.22),transparent_72%)]" />

      <div className="relative z-[1]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c0efd6]">Recovery flow</div>

        <div className="mt-4 grid items-center gap-3 lg:grid-cols-[5rem_1fr_5rem]">
          <div className="rounded-xl border border-white/20 bg-white/10 p-2 text-center text-[11px] text-[#d7ecdf]">
            <div className="text-[10px] opacity-80">Due</div>
            <div className="mt-1 text-lg font-semibold text-white">{totalDue}</div>
          </div>

          <div>
            <div className="relative h-3 overflow-hidden rounded-full bg-white/15">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#9de2bd,#72c29b)]" style={{ width: `${clearShare}%` }} />
              <div className="absolute inset-y-0" style={{ left: `${Math.max(8, clearShare - 6)}%` }}>
                <div className="h-full w-6 rounded-full bg-white/40 blur-[1px]" />
              </div>
            </div>
            <div className="mt-2 text-[11px] text-[#d7ecdf]">Clearing now: {block} items ({clearShare}%)</div>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/10 p-2 text-center text-[11px] text-[#d7ecdf]">
            <div className="text-[10px] opacity-80">Deferred</div>
            <div className="mt-1 text-lg font-semibold text-white">{deferred}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-[#d1e8dd]">
          {topTopic ? `Top topic: ${topTopic}` : "Top topic pending"}
          <span className="mx-2 text-white/40">•</span>
          {topReason ? `Top reason: ${topReason}` : "Reason pending"}
        </div>
      </div>
    </section>
  );
}

export function ReviewOutcomeCompanion({
  before,
  after,
  accuracy,
  weakCount,
  repairedLabel,
}: {
  before: number | null;
  after: number | null;
  accuracy: number;
  weakCount: number;
  repairedLabel: string | null;
}) {
  const beforeValue = before ?? 0;
  const afterValue = after ?? 0;
  const max = Math.max(beforeValue, afterValue, 1);
  const beforePct = clamp(Math.round((beforeValue / max) * 100), 10, 100);
  const afterPct = clamp(Math.round((afterValue / max) * 100), afterValue > 0 ? 10 : 0, 100);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(142deg,#13283d,#174255_58%,#195364)] p-5">
      <div className="pointer-events-none absolute -top-16 right-10 h-40 w-40 rounded-full border border-white/15" />
      <div className="relative z-[1]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c2efd8]">Stabilization proof</div>

        <div className="mt-4 grid grid-cols-[1fr_1fr_1fr] items-end gap-3">
          <div>
            <div className="text-[10px] text-[#d0eadc]">Before</div>
            <div className="mt-1 h-20 rounded-t-lg bg-[linear-gradient(180deg,#9bcfb7,#5d987a)]" style={{ opacity: beforePct / 100 }} />
            <div className="mt-1 text-sm font-semibold text-white">{before ?? "-"}</div>
          </div>

          <div className="pb-2 text-center">
            <div className="mx-auto h-8 w-8 rounded-full border border-white/40 bg-white/10" />
            <div className="mt-2 text-[11px] text-[#d5ecdf]">{accuracy}% accuracy</div>
          </div>

          <div>
            <div className="text-[10px] text-[#d0eadc]">After</div>
            <div className="mt-1 h-20 rounded-t-lg bg-[linear-gradient(180deg,#9adfbe,#4ea47b)]" style={{ opacity: afterPct / 100 }} />
            <div className="mt-1 text-sm font-semibold text-white">{after ?? "-"}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-[#d4ebde]">
          Repair focus: {repairedLabel || "No dominant topic"}
          <span className="mx-2 text-white/40">•</span>
          Still weak: {weakCount}
        </div>
      </div>
    </section>
  );
}

export function SkillsMapCompanion({
  unstable,
  growing,
  mastered,
  untouched,
  movementDelta,
}: {
  unstable: number;
  growing: number;
  mastered: number;
  untouched: number;
  movementDelta: number | null;
}) {
  const total = Math.max(unstable + growing + mastered + untouched, 1);
  const unstablePct = clamp(Math.round((unstable / total) * 100), 0, 100);
  const growingPct = clamp(Math.round((growing / total) * 100), 0, 100);
  const masteredPct = clamp(Math.round((mastered / total) * 100), 0, 100);
  const moveText = movementDelta === null ? "pending" : `${movementDelta >= 0 ? "+" : ""}${movementDelta}%`;

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(144deg,#1a2147,#1b3462_56%,#1f4371)] p-5">
      <svg viewBox="0 0 280 180" className="absolute inset-0 h-full w-full opacity-70" aria-hidden="true">
        <path d="M16 110 C44 72, 88 62, 120 86 C150 109, 182 92, 208 72 C234 52, 256 66, 266 88 L266 164 L16 164 Z" fill="rgba(152,221,183,0.35)" />
        <path d="M14 92 C38 58, 84 48, 118 64 C142 76, 170 74, 198 56 C220 42, 246 44, 266 60 L266 18 L14 18 Z" fill="rgba(248,209,139,0.34)" />
        <path d="M20 142 C44 122, 74 118, 100 128 C128 138, 162 132, 194 120 C222 110, 246 118, 264 132 L264 166 L20 166 Z" fill="rgba(245,164,184,0.3)" />
        <path d="M20 98 C62 78, 100 80, 132 96 C168 114, 202 106, 244 80" stroke="rgba(208,225,255,0.8)" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      <div className="relative z-[1]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c9d7ff]">Mastery territory</div>
        <div className="mt-2 text-sm text-[#dae5ff]">Unstable {unstablePct}% • Growing {growingPct}% • Mastered {masteredPct}%</div>
        <div className="mt-20 flex items-center justify-between text-[11px] text-[#e1e9ff]">
          <span>Unstable {unstable}</span>
          <span>Growing {growing}</span>
          <span>Mastered {mastered}</span>
        </div>
        <div className="mt-2 text-[11px] text-[#d2dcff]">Movement signal: {moveText}</div>
      </div>
    </section>
  );
}

export function HistoryTrajectoryCompanion({
  delta,
  gainLabel,
  dropLabel,
  reviewDue,
}: {
  delta: number | null;
  gainLabel: string | null;
  dropLabel: string | null;
  reviewDue: number;
}) {
  const d = delta === null ? 0 : clamp(delta, -35, 35);
  const endY = clamp(64 - d, 16, 72);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(144deg,#18234a,#243a71_58%,#2a447e)] p-5">
      <svg viewBox="0 0 220 100" className="absolute inset-x-0 bottom-0 h-[70%] w-full" aria-hidden="true">
        <path d="M10 82 C44 56, 78 62, 108 48 C142 32, 170 40, 210 22 L210 100 L10 100 Z" fill="rgba(157,190,255,0.2)" />
        <path d="M10 82 C44 56, 78 62, 108 48 C142 32, 170 40, 210 22" stroke="rgba(203,224,255,0.95)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="210" cy="22" r="4" fill="#e2efff" />
      </svg>

      <div className="relative z-[1]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#cad8ff]">Movement trajectory</div>
        <div className="mt-2 text-2xl font-semibold text-white">{delta === null ? "Pending proof" : `${delta >= 0 ? "+" : ""}${delta}%`}</div>
        <div className="mt-1 text-[11px] text-[#d8e3ff]">{gainLabel ? `Gain: ${gainLabel}` : "No clear gain"}</div>
        <div className="mt-1 text-[11px] text-[#d8e3ff]">{dropLabel ? `Drop: ${dropLabel}` : "No clear drop"}</div>
        <div className="mt-3 text-[11px] text-[#d0dcfb]">Review pressure: {reviewDue > 0 ? `${reviewDue} due` : "clear"}</div>
      </div>
    </section>
  );
}

export function CoachStrategistCompanion({
  due,
  weakCount,
  aiWindow,
  division,
}: {
  due: number;
  weakCount: number;
  aiWindow: string;
  division: string;
}) {
  const dueX = clamp(52 + due * 2, 52, 118);
  const weakY = clamp(66 - weakCount * 4, 16, 66);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/15 bg-[linear-gradient(144deg,#142547,#1a345f_58%,#204071)] p-5">
      <svg viewBox="0 0 220 120" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="38" cy="92" r="7" fill="rgba(206,224,255,0.9)" />
        <circle cx="102" cy="58" r="7" fill="rgba(206,224,255,0.9)" />
        <circle cx="168" cy="34" r="7" fill="rgba(206,224,255,0.9)" />
        <circle cx="188" cy="88" r="7" fill="rgba(206,224,255,0.9)" />
        <path d="M38 92 L102 58 L168 34" stroke="rgba(194,218,255,0.95)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M102 58 L188 88" stroke="rgba(194,218,255,0.5)" strokeWidth="2" fill="none" strokeDasharray="5 4" />
        <circle cx={dueX} cy={weakY} r="10" fill="rgba(153,208,255,0.3)" stroke="rgba(204,234,255,0.9)" strokeWidth="1.6" />
      </svg>

      <div className="relative z-[1]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c2d8ff]">Strategy graph</div>
        <div className="mt-2 text-sm text-[#d7e5ff]">Route intelligence for immediate next move</div>
        <div className="mt-14 text-[11px] text-[#d0ddfb]">Debt {due} • Weak targets {weakCount} • AI {aiWindow}</div>
        <div className="mt-1 text-[11px] text-[#d0ddfb]">Division {division}</div>
      </div>
    </section>
  );
}

export function CommunityProofCompanion({
  due,
  weakLabel,
  cadence,
}: {
  due: number;
  weakLabel: string;
  cadence: string;
}) {
  const clarity = clamp(88 - due * 5, 24, 94);

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#d6e4ff] bg-[linear-gradient(145deg,#f6faff,#edf4ff)] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#004aad]">Weekly signal scene</div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#dbe8ff]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#8cb8ff,#5f93ea)]" style={{ width: `${clarity}%` }} />
      </div>
      <div className="mt-3 text-[11px] text-[#324f79]">Debt {due > 0 ? `${due} due` : "clear"} • Weakest {weakLabel}</div>
      <div className="mt-1 text-[11px] text-[#324f79]">Cadence {cadence}</div>
    </section>
  );
}
