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
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      {(title || subtitle || right) && (
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            {title && <div className="text-sm font-semibold text-gray-800">{title}</div>}
            {subtitle && <div className="text-xs text-gray-600 mt-1">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls =
    "w-full rounded-xl bg-black text-white py-3 px-4 font-medium text-center disabled:opacity-60";
  if (href) return <a className={cls} href={href}>{children}</a>;
  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "w-full rounded-xl border py-3 px-4 font-medium text-center hover:bg-gray-50";
  if (href) return <a className={cls} href={href}>{children}</a>;
  return <button className={cls} onClick={onClick}>{children}</button>;
}

export function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-gray-700">
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
    <div className="rounded-xl border p-4">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
