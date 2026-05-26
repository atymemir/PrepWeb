import { SAT_CALCULATOR_STRATEGY, SAT_FORMULAS } from "../data/satMathTools";

export default function SatMathTools({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">SAT math tools</div>
      <div className="mt-2 text-sm font-semibold text-black">Use this only when it saves time.</div>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Formula quicksheet</div>
          <div className="mt-2 grid gap-2">
            {SAT_FORMULAS.map((item) => (
              <div key={item.name} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs font-semibold text-black">{item.name}</div>
                <div className="mt-1 text-xs text-gray-700">{item.formula}</div>
                {!compact && <div className="mt-1 text-[11px] text-gray-500">{item.when}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Calculator vs algebra</div>
          <div className="mt-2 grid gap-2">
            {SAT_CALCULATOR_STRATEGY.map((tip) => (
              <div key={tip.title} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs font-semibold text-black">{tip.title}</div>
                <div className="mt-1 text-[11px] text-gray-700">{tip.quickRule}</div>
                {!compact && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    Use: {tip.doWhen}
                    <br />
                    Avoid: {tip.avoidWhen}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
