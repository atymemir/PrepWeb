import Link from "next/link";
import React from "react";

export function PageHeader({
  title,
  subtitle,
  right,
  label,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-3xl border border-gray-200/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(247,250,255,0.9))] shadow-md sm:mb-7">
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {label && (
            <div className="mb-3 inline-flex items-center rounded-full border border-[#b9d6ff] bg-[#eef5ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#004aad]">
              {label}
            </div>
          )}
          <h1 className="display-font text-3xl font-semibold tracking-tight text-[#0e1b34] sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-[15px]">
              {subtitle}
            </p>
          )}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
  accent = false,
  prominence = "default",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
  prominence?: "quiet" | "default" | "prominent";
}) {
  let containerClass = "";
  let headerClass = "";
  let paddingClass = "";

  if (prominence === "prominent") {
    containerClass = accent
      ? "overflow-hidden rounded-3xl border border-[#9dc0f6] bg-white shadow-xl ring-1 ring-[#b8d4ff]"
      : "overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-lg ring-1 ring-black/5";
    headerClass = accent
      ? "flex items-start justify-between gap-4 border-b border-[#b9d6ff] bg-[linear-gradient(145deg,#eff6ff,#f7faff)] px-6 py-5"
      : "flex items-start justify-between gap-4 border-b border-gray-200 bg-[linear-gradient(145deg,#fbfcff,#f8fafc)] px-6 py-5";
    paddingClass = "p-6";
  } else if (prominence === "quiet") {
    containerClass = "overflow-hidden rounded-2xl border border-gray-200 bg-[rgba(255,255,255,0.86)] shadow-sm";
    headerClass = "flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3";
    paddingClass = "p-4";
  } else {
    containerClass = accent
      ? "overflow-hidden rounded-3xl border border-[#c3dafd] bg-[rgba(255,255,255,0.95)] shadow-md"
      : "overflow-hidden rounded-3xl border border-gray-200 bg-[rgba(255,255,255,0.92)] shadow-sm";
    headerClass = accent
      ? "flex items-start justify-between gap-4 border-b border-[#d8e8ff] bg-[linear-gradient(145deg,#f5f9ff,#fcfdff)] px-5 py-4"
      : "flex items-start justify-between gap-4 border-b border-gray-200 bg-[linear-gradient(145deg,#fcfdff,#ffffff)] px-5 py-4";
    paddingClass = "p-5";
  }

  return (
    <section className={containerClass}>
      {(title || subtitle || right) && (
        <div className={headerClass}>
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-[#0f172a]">{title}</div>}
            {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      <div className={paddingClass}>{children}</div>
    </section>
  );
}

export function Pill({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "accent" | "success" | "danger";
}) {
  const cls =
    tone === "accent"
      ? "border-[#b9d6ff] bg-[#eef5ff] text-[#004aad] font-semibold"
      : tone === "success"
      ? "border-[#9de0bb] bg-[#ebfdf2] text-[#0f8a4e] font-semibold"
      : tone === "danger"
      ? "border-[#f5b8c4] bg-[#fff2f5] text-[#b02039] font-semibold"
      : "border-gray-200 bg-white text-gray-700 font-medium";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs tracking-[0.02em] ${cls}`}>
      {text}
    </span>
  );
}

export function StatBox({
  label,
  value,
  hint,
  accent = false,
  size = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  size?: "default" | "large";
}) {
  const containerClass = accent
    ? "rounded-2xl border border-[#b9d6ff] bg-[linear-gradient(140deg,#edf5ff,#f8fbff)] p-5 shadow-sm"
    : "rounded-2xl border border-gray-200 bg-white p-4";

  const labelClass = accent ? "text-xs font-semibold text-[#004aad]" : "text-xs font-semibold text-gray-600";
  const valueClass = accent
    ? `${size === "large" ? "text-3xl" : "text-2xl"} font-bold tracking-tight text-[#0e1b34]`
    : `${size === "large" ? "text-3xl" : "text-2xl"} font-semibold tracking-tight text-[#0f172a]`;

  return (
    <div className={containerClass}>
      <div className={labelClass}>{label}</div>
      <div className={`mt-2 break-words ${valueClass}`}>{value}</div>
      {hint && <div className="mt-2 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

export function PrimaryButton({
  href,
  onClick,
  children,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const cls =
    "inline-flex w-full items-center justify-center rounded-xl border border-[#0e1b34] bg-[#0e1b34] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a2b4a] disabled:opacity-60";

  if (href) {
    return (
      <Link className={cls} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  href,
  onClick,
  children,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const cls =
    "inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60";

  if (href) {
    return (
      <Link className={cls} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function TertiaryButton({
  href,
  onClick,
  children,
  disabled,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const cls = "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-white hover:text-black disabled:opacity-60";

  if (href) {
    return (
      <Link className={cls} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

const LOOP_STEPS = ["Practice", "Review", "Skills", "Lessons", "Coach"] as const;

export function LoopRail({
  active,
  next,
  note,
}: {
  active?: (typeof LOOP_STEPS)[number];
  next?: (typeof LOOP_STEPS)[number];
  note?: string;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-[rgba(255,255,255,0.86)] px-4 py-4 shadow-sm backdrop-blur sm:mb-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {LOOP_STEPS.map((step, index) => {
            const isActive = active === step;
            const isNext = next === step;

            return (
              <React.Fragment key={step}>
                <div
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    isActive
                      ? "border-[#0e1b34] bg-[#0e1b34] text-white"
                      : isNext
                      ? "border-[#b9d6ff] bg-[#eef5ff] text-[#004aad]"
                      : "border-gray-200 bg-white text-gray-600",
                  ].join(" ")}
                >
                  {isNext ? `Next: ${step}` : step}
                </div>
                {index < LOOP_STEPS.length - 1 ? (
                  <div className="h-px w-3 bg-gray-300" aria-hidden="true" />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        {note ? <div className="text-xs leading-relaxed text-gray-500">{note}</div> : null}
      </div>
    </div>
  );
}

export function PagePurpose({
  purpose,
  instruction,
  why,
}: {
  purpose: string;
  instruction: string;
  why?: string;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-[#c6dbfb] bg-[linear-gradient(145deg,#eff7ff,#f8fbff)] p-4 sm:mb-6 sm:p-5">
      <div className="label label-accent">Page purpose</div>
      <div className="mt-2 text-base font-semibold text-[#0f172a]">{purpose}</div>
      <div className="mt-2 text-sm leading-relaxed text-gray-700">{instruction}</div>
      {why ? <div className="mt-2 text-xs text-gray-600">{why}</div> : null}
    </div>
  );
}

export function ActionDock({
  title,
  note,
  primary,
  secondary,
}: {
  title: string;
  note?: string;
  primary: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
  secondary?: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-[rgba(244,248,254,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-xl backdrop-blur md:hidden">
      <div className="mx-auto max-w-6xl rounded-2xl border border-white/80 bg-white/80 p-3 shadow-md">
        <div className="text-xs font-semibold text-[#0f172a]">{title}</div>
        {note ? <div className="mt-1 text-xs text-gray-500">{note}</div> : null}
        <div className="mt-3 grid gap-2">
          <PrimaryButton href={primary.href} onClick={primary.onClick} disabled={primary.disabled}>
            {primary.label}
          </PrimaryButton>
          {secondary ? (
            <SecondaryButton href={secondary.href} onClick={secondary.onClick} disabled={secondary.disabled}>
              {secondary.label}
            </SecondaryButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
