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
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      {(title || subtitle || right) && (
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            {title && <div className="text-sm font-semibold text-black">{title}</div>}
            {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
      {text}
    </span>
  );
}

export function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-black">{value}</div>
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
    "inline-flex w-full items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition";

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
    "inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-50 disabled:opacity-60 transition";

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