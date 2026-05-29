import React from "react";

type AnchorTone = "neutral" | "accent" | "success" | "danger";
type AnchorVariant = "mission" | "attack" | "recovery" | "progress" | "history" | "onboarding" | "coach";

type AnchorMetric = {
  label: string;
  value: string;
  note?: string;
  tone?: AnchorTone;
};

function toneClass(tone: AnchorTone): string {
  if (tone === "danger") return "border-[#f5b8c4] bg-[#fff2f5] text-[#8f1d35]";
  if (tone === "success") return "border-[#9de0bb] bg-[#ebfdf2] text-[#0f8a4e]";
  if (tone === "accent") return "border-[#bdd8ff] bg-[#eef5ff] text-[#0e1b34]";
  return "border-white/25 bg-white/10 text-[#d9e5fb]";
}

const BAR_MAP: Record<AnchorVariant, number[]> = {
  mission: [24, 36, 48, 65, 58, 72],
  attack: [22, 44, 54, 63, 57, 76],
  recovery: [64, 56, 49, 42, 34, 27],
  progress: [18, 29, 45, 57, 62, 74],
  history: [27, 48, 39, 60, 52, 70],
  onboarding: [20, 34, 46, 59, 67, 74],
  coach: [25, 38, 51, 47, 63, 71],
};

export default function VisualAnchorPanel({
  variant,
  eyebrow,
  title,
  subtitle,
  metrics,
  footer,
}: {
  variant: AnchorVariant;
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: AnchorMetric[];
  footer?: string;
}) {
  const bars = BAR_MAP[variant];

  return (
    <section className={`visual-anchor-panel visual-anchor-${variant}`}>
      <div className="visual-anchor-orb" aria-hidden="true" />
      <div className="visual-anchor-grid" aria-hidden="true" />

      <div className="relative z-[1]">
        <div className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c7dcff]">
          {eyebrow}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#c5d3ec]">{subtitle}</p>

        <div className="mt-4 grid gap-2">
          {metrics.slice(0, 4).map((metric) => (
            <div key={metric.label} className={`rounded-xl border px-3 py-2 ${toneClass(metric.tone ?? "neutral")}`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">{metric.label}</div>
              <div className="mt-1 text-sm font-semibold">{metric.value}</div>
              {metric.note ? <div className="mt-1 text-[11px] leading-relaxed opacity-80">{metric.note}</div> : null}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div className="flex items-end gap-1.5">
            {bars.map((height, idx) => (
              <span
                key={`${variant}-bar-${idx}`}
                className="w-2 rounded-full bg-[linear-gradient(180deg,rgba(187,217,255,0.92),rgba(119,158,226,0.5))]"
                style={{ height }}
              />
            ))}
          </div>
          {footer ? <div className="max-w-[11rem] text-right text-[11px] leading-relaxed text-[#c6d6f3]">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}
