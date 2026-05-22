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
    <div className="mb-8 flex flex-col gap-3 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {label && (
          <div className="label mb-2">
            {label}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">{subtitle}</p>}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
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
  let headerBg = "";
  let padding = "";

  // Container class logic
  if (prominence === "prominent") {
    containerClass = "overflow-hidden rounded-xl border-2 shadow-lg bg-white";
    if (accent) {
      containerClass = "overflow-hidden rounded-xl border-2 shadow-lg bg-white border-[#004aad]";
    } else {
      containerClass = "overflow-hidden rounded-xl border-2 shadow-lg bg-white border-gray-300";
    }
  } else if (prominence === "quiet") {
    containerClass = "overflow-hidden rounded-lg border bg-gray-50 shadow-none border-gray-100";
  } else {
    // default
    containerClass = "overflow-hidden rounded-xl border shadow-sm bg-white";
    if (accent) {
      containerClass = "overflow-hidden rounded-xl border shadow-sm bg-white border-[#b7d2ff]";
    } else {
      containerClass = "overflow-hidden rounded-xl border shadow-sm bg-white border-gray-200";
    }
  }

  // Header class logic
  if (prominence === "prominent") {
    headerClass = "flex items-start justify-between gap-4 border-b-2 px-6 py-5";
  } else if (prominence === "quiet") {
    headerClass = "flex items-start justify-between gap-4 border-b px-4 py-3";
  } else {
    headerClass = "flex items-start justify-between gap-4 border-b px-5 py-4";
  }

  // Header background logic
  if (prominence === "quiet") {
    headerBg = "bg-transparent border-gray-100";
  } else if (accent) {
    headerBg = "bg-[#f6faff] border-[#b7d2ff]";
  } else {
    headerBg = "bg-white border-gray-200";
  }

  // Padding logic
  if (prominence === "prominent") {
    padding = "p-6";
  } else if (prominence === "quiet") {
    padding = "p-3";
  } else {
    padding = "p-5";
  }

  return (
    <div className={containerClass}>
      {(title || subtitle || right) && (
        <div className={`${headerClass} ${headerBg}`}>
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-black">{title}</div>}
            {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      <div className={padding}>{children}</div>
    </div>
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
      ? "border-[#b7d2ff] bg-[#eef4ff] text-[#004aad] font-semibold"
      : tone === "success"
      ? "border-green-300 bg-green-50 text-green-700 font-semibold"
      : tone === "danger"
      ? "border-red-300 bg-red-50 text-red-700 font-semibold"
      : "border-gray-200 bg-gray-50 text-gray-700 font-medium";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs ${cls}`}>
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
    ? "rounded-lg border-2 border-[#c7dbff] bg-[#f6faff] p-5"
    : "rounded-lg border border-gray-200 bg-white p-4";

  const labelClass = accent ? "text-xs font-semibold text-[#004aad]" : "text-xs font-semibold text-gray-600";
  const valueClass = accent
    ? `${size === "large" ? "text-3xl" : "text-2xl"} font-bold tracking-tight text-[#004aad]`
    : `${size === "large" ? "text-3xl" : "text-2xl"} font-semibold tracking-tight text-black`;

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
    "inline-flex w-full items-center justify-center rounded-lg bg-[#004aad] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003b88] disabled:opacity-60";

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
    "inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-50 disabled:opacity-60";

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
  const cls = "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:text-black hover:bg-gray-50 disabled:opacity-60";

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
  note,
}: {
  active?: (typeof LOOP_STEPS)[number];
  note?: string;
}) {
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {LOOP_STEPS.map((step, index) => {
            const isActive = active === step;

            return (
              <React.Fragment key={step}>
                <div
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    isActive
                      ? "border-[#004aad] bg-[#eef4ff] text-[#004aad] shadow-sm"
                      : "border-gray-200 bg-white text-gray-600",
                  ].join(" ")}
                >
                  {step}
                </div>
                {index < LOOP_STEPS.length - 1 ? (
                  <div className="h-px w-3 bg-gray-200" aria-hidden="true" />
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
