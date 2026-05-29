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
    <section className="surface-card-strong mb-5 overflow-hidden sm:mb-7">
      <div className="flex flex-col gap-4 px-5 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {label ? (
            <div className="mb-3 inline-flex items-center rounded-full border border-[#c7dbff] bg-[#eef5ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#004aad]">
              {label}
            </div>
          ) : null}
          <h1 className="display-font text-3xl font-semibold tracking-tight text-[#0e1b34] sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4d607f] sm:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </section>
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
  const containerClass =
    prominence === "prominent"
      ? accent
        ? "overflow-hidden rounded-[24px] border border-[#a9c9fa] bg-white shadow-lg"
        : "overflow-hidden rounded-[24px] border border-gray-300 bg-white shadow-lg"
      : prominence === "quiet"
      ? "overflow-hidden rounded-[16px] border border-gray-200 bg-[rgba(255,255,255,0.86)] shadow-sm"
      : accent
      ? "overflow-hidden rounded-[20px] border border-[#c7dbff] bg-[rgba(255,255,255,0.95)] shadow-sm"
      : "overflow-hidden rounded-[20px] border border-gray-200 bg-[rgba(255,255,255,0.92)] shadow-sm";

  const headerClass =
    prominence === "prominent"
      ? accent
        ? "flex items-start justify-between gap-4 border-b border-[#cfe2ff] bg-[linear-gradient(145deg,#f2f7ff,#f9fcff)] px-6 py-5"
        : "flex items-start justify-between gap-4 border-b border-gray-200 bg-[linear-gradient(145deg,#fbfcff,#ffffff)] px-6 py-5"
      : prominence === "quiet"
      ? "flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3"
      : accent
      ? "flex items-start justify-between gap-4 border-b border-[#dbe9ff] bg-[linear-gradient(145deg,#f6faff,#fcfdff)] px-5 py-4"
      : "flex items-start justify-between gap-4 border-b border-gray-200 bg-[linear-gradient(145deg,#fcfdff,#ffffff)] px-5 py-4";

  const paddingClass = prominence === "prominent" ? "p-6" : prominence === "quiet" ? "p-4" : "p-5";

  return (
    <section className={containerClass}>
      {(title || subtitle || right) && (
        <div className={headerClass}>
          <div className="min-w-0">
            {title ? <div className="text-sm font-semibold text-[#0f172a]">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm text-[#516483]">{subtitle}</div> : null}
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
      ? "border-[#bcd7ff] bg-[#eef5ff] text-[#004aad]"
      : tone === "success"
      ? "border-[#9de0bb] bg-[#ebfdf2] text-[#0f8a4e]"
      : tone === "danger"
      ? "border-[#f5b8c4] bg-[#fff2f5] text-[#b02039]"
      : "border-gray-200 bg-white text-[#516483]";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.02em] ${cls}`}>
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
    ? "rounded-2xl border border-[#c7dbff] bg-[linear-gradient(140deg,#edf5ff,#f8fbff)] p-5"
    : "rounded-2xl border border-gray-200 bg-white p-4";

  const valueClass = `${size === "large" ? "text-3xl" : "text-2xl"} ${
    accent ? "font-bold text-[#0e1b34]" : "font-semibold text-[#0f172a]"
  } tracking-tight`;

  return (
    <div className={containerClass}>
      <div className={accent ? "text-xs font-semibold text-[#004aad]" : "text-xs font-semibold text-[#516483]"}>
        {label}
      </div>
      <div className={`mt-2 break-words ${valueClass}`}>{value}</div>
      {hint ? <div className="mt-2 text-xs text-[#617394]">{hint}</div> : null}
    </div>
  );
}

const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center rounded-xl border border-[#0e1b34] bg-[linear-gradient(135deg,#0f1b33,#1a2c4e)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 disabled:opacity-60";

const SECONDARY_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-[linear-gradient(145deg,#ffffff,#f8fbff)] px-4 py-3 text-sm font-semibold text-[#0f172a] shadow-sm transition hover:-translate-y-0.5 hover:border-gray-400 hover:bg-gray-50 active:translate-y-0 disabled:opacity-60";

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
  if (href) {
    return (
      <Link className={PRIMARY_BUTTON_CLASS} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={PRIMARY_BUTTON_CLASS} onClick={onClick} disabled={disabled}>
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
  if (href) {
    return (
      <Link className={SECONDARY_BUTTON_CLASS} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={SECONDARY_BUTTON_CLASS} onClick={onClick} disabled={disabled}>
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
  const cls =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-[#5a6e8f] transition hover:bg-white hover:text-[#0e1b34] disabled:opacity-60";

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

const LOOP_STEPS = ["Today", "Practice", "Review", "Skills", "Lessons", "Coach"] as const;

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
    <section className="surface-card mb-4 px-4 py-4 sm:mb-6">
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
                      : "border-gray-200 bg-white text-[#607493]",
                  ].join(" ")}
                >
                  {isNext ? `Next: ${step}` : step}
                </div>
                {index < LOOP_STEPS.length - 1 ? <div className="h-px w-3 bg-gray-300" aria-hidden="true" /> : null}
              </React.Fragment>
            );
          })}
        </div>

        {note ? <div className="text-xs leading-relaxed text-[#657897]">{note}</div> : null}
      </div>
    </section>
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
    <section className="mb-4 rounded-2xl border border-[#c6dbfb] bg-[linear-gradient(145deg,#eff7ff,#f8fbff)] p-4 sm:mb-6 sm:p-5">
      <div className="label label-accent">Page purpose</div>
      <div className="mt-2 text-base font-semibold text-[#0f172a]">{purpose}</div>
      <div className="mt-2 text-sm leading-relaxed text-[#425675]">{instruction}</div>
      {why ? <div className="mt-2 text-xs text-[#5d6f8e]">{why}</div> : null}
    </section>
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
      <div className="mx-auto max-w-6xl rounded-2xl border border-white/80 bg-white/85 p-3 shadow-md">
        <div className="text-xs font-semibold text-[#0f172a]">{title}</div>
        {note ? <div className="mt-1 text-xs text-[#5f7394]">{note}</div> : null}
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
