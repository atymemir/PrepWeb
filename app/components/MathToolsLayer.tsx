import { SAT_CALCULATOR_STRATEGY, SAT_FORMULAS } from "../data/satMathTools";

type MathToolsLayerProps = {
  open: boolean;
  onClose: () => void;
  topicHint?: string | null;
  modeLabel?: string;
};

export default function MathToolsLayer({
  open,
  onClose,
  topicHint,
  modeLabel,
}: MathToolsLayerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close math tools"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <aside className="absolute inset-x-0 bottom-0 max-h-[84vh] overflow-y-auto rounded-t-3xl border border-gray-200 bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[28rem] md:max-h-none md:rounded-none md:rounded-l-2xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                SAT Tool Layer
              </div>
              <div className="mt-1 text-base font-semibold text-black">Math tools</div>
              <div className="mt-1 text-xs text-gray-600">
                {modeLabel ? `${modeLabel} mode` : "Practice mode"}
                {topicHint ? ` • ${topicHint}` : ""}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              Formula reference
            </div>
            <div className="mt-3 grid gap-2">
              {SAT_FORMULAS.map((item) => (
                <div key={item.name} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold text-black">{item.name}</div>
                  <div className="mt-1 text-xs text-gray-700">{item.formula}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
              Calculator and Desmos strategy
            </div>
            <div className="mt-3 grid gap-2">
              {SAT_CALCULATOR_STRATEGY.map((tip) => (
                <div key={tip.title} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-xs font-semibold text-black">{tip.title}</div>
                  <div className="mt-1 text-xs text-gray-700">{tip.quickRule}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-[#b7d2ff] bg-[#f6faff] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Desmos slot
            </div>
            <div className="mt-2 text-sm font-semibold text-black">Future interactive graph panel</div>
            <div className="mt-1 text-xs text-gray-700">
              Reserved space for native graphing and expression scratchpad integration.
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
