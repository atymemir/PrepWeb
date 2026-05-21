import Link from "next/link";
import React from "react";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">{subtitle}</p>}
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
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        accent ? "border-[#b7d2ff]" : "border-gray-200",
      ].join(" ")}
    >
      {(title || subtitle || right) && (
        <div
          className={[
            "flex items-start justify-between gap-4 border-b px-5 py-4",
            accent ? "border-[#b7d2ff] bg-[#f3f7ff]" : "border-gray-200 bg-white",
          ].join(" ")}
        >
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-black">{title}</div>}
            {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
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
      ? "border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
      : tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-gray-200 bg-white text-gray-600";

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

export function StatBox({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-lg border p-4 ${accent ? "border-[#c7dbff] bg-[#f3f7ff]" : "border-gray-200 bg-white"}`}>
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <div className={`mt-1 break-words text-2xl font-semibold tracking-tight ${accent ? "text-[#004aad]" : "text-black"}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
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

const LOOP_STEPS = ["Practice", "Review", "Skills", "Lessons", "Coach"] as const;

export function LoopRail({
  active,
  note,
}: {
  active?: (typeof LOOP_STEPS)[number];
  note?: string;
}) {
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {LOOP_STEPS.map((step, index) => {
            const isActive = active === step;

            return (
              <React.Fragment key={step}>
                <div
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    isActive
                      ? "border-[#c7dbff] bg-[#eef4ff] text-[#004aad]"
                      : "border-gray-200 bg-white text-gray-600",
                  ].join(" ")}
                >
                  {step}
                </div>
                {index < LOOP_STEPS.length - 1 ? (
                  <div className="h-px w-4 bg-gray-200" aria-hidden="true" />
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
