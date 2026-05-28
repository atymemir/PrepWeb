'use client';

type TestingToolsDockProps = {
  calculatorOpen: boolean;
  calculatorMinimized: boolean;
  referenceOpen: boolean;
  onOpenCalculator: () => void;
  onMinimizeCalculator: () => void;
  onCloseCalculator: () => void;
  onToggleReference: () => void;
};

export default function TestingToolsDock({
  calculatorOpen,
  calculatorMinimized,
  referenceOpen,
  onOpenCalculator,
  onMinimizeCalculator,
  onCloseCalculator,
  onToggleReference,
}: TestingToolsDockProps) {
  const calculatorLabel = !calculatorOpen
    ? "Calculator"
    : calculatorMinimized
    ? "Calculator (min)"
    : "Calculator (open)";

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#415b8d] bg-[#0e1b34]/80 px-2 py-1.5">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#bdd4ff]">
        Tools
      </div>
      <button
        onClick={onOpenCalculator}
        className={[
          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
          calculatorOpen
            ? "border-[#93b4ea] bg-[#eef4ff] text-[#0f1b33]"
            : "border-[#4f6795] bg-white/10 text-[#d7e3fb] hover:bg-white/20",
        ].join(" ")}
      >
        {calculatorLabel}
      </button>
      <button
        onClick={onToggleReference}
        className={[
          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
          referenceOpen
            ? "border-[#93b4ea] bg-[#eef4ff] text-[#0f1b33]"
            : "border-[#4f6795] bg-white/10 text-[#d7e3fb] hover:bg-white/20",
        ].join(" ")}
      >
        {referenceOpen ? "Reference (open)" : "Reference"}
      </button>
      {calculatorOpen && !calculatorMinimized && (
        <button
          onClick={onMinimizeCalculator}
          className="rounded-full border border-[#4f6795] bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#d7e3fb] transition hover:bg-white/20"
        >
          Minimize
        </button>
      )}
      {calculatorOpen && (
        <button
          onClick={onCloseCalculator}
          className="rounded-full border border-[#4f6795] bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#d7e3fb] transition hover:bg-white/20"
        >
          Close
        </button>
      )}
    </div>
  );
}
