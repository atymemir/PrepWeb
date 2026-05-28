'use client';

import { useEffect, useMemo, useState } from "react";
import {
  SAT_CALCULATOR_STRATEGY,
  SAT_FORMULAS,
  type SatFormula,
  type SatMathToolTip,
} from "../data/satMathTools";

type MathToolsLayerProps = {
  open: boolean;
  onClose: () => void;
  topicHint?: string | null;
  modeLabel?: string;
  strictExam?: boolean;
};

type ToolTab = "topic" | "formula" | "strategy" | "desmos";

type TopicPreset = {
  title: string;
  fastMove: string;
  calculatorWhen: string;
  algebraWhen: string;
  formulaNames: string[];
  tipTitles: string[];
};

const DEFAULT_PRESET: TopicPreset = {
  title: "General SAT Math",
  fastMove: "Simplify structure first, then compute.",
  calculatorWhen: "Calculator is for arithmetic load, not for deciding structure.",
  algebraWhen: "If cancellation/factoring is clean, algebra is faster than key presses.",
  formulaNames: ["Slope", "Distance", "Exponent rules"],
  tipTitles: [
    "Calculator is better for decimal-heavy arithmetic",
    "Algebra is faster for symbolic cancellation",
  ],
};

function topicPreset(topicHint?: string | null): TopicPreset {
  const t = (topicHint || "").toLowerCase();
  if (!t) return DEFAULT_PRESET;

  if (/(linear|system|slope|line|intercept)/.test(t)) {
    return {
      title: "Linear / Systems",
      fastMove: "Convert both expressions to a comparable form before solving.",
      calculatorWhen: "Use graph/check mode for intersection verification after setup.",
      algebraWhen: "Elimination/substitution is usually faster for exact values.",
      formulaNames: ["Slope", "Distance"],
      tipTitles: ["Desmos wins for visual intersection checks"],
    };
  }

  if (/(quadratic|polynomial|parabola|roots?)/.test(t)) {
    return {
      title: "Quadratics / Polynomials",
      fastMove: "Try factoring pattern first, then use quadratic formula if needed.",
      calculatorWhen: "Use graph to validate roots after symbolic solving.",
      algebraWhen: "Exact root form is faster when coefficients are manageable.",
      formulaNames: ["Quadratic roots", "Exponent rules"],
      tipTitles: [
        "Desmos wins for visual intersection checks",
        "Algebra is faster for symbolic cancellation",
      ],
    };
  }

  if (/(geometry|circle|triangle|trig|angle|radius)/.test(t)) {
    return {
      title: "Geometry / Trigonometry",
      fastMove: "Draw and label before arithmetic. Use formula only after setup.",
      calculatorWhen: "Helpful when final arithmetic is decimal-heavy.",
      algebraWhen: "Special-angle and ratio simplifications are faster by hand.",
      formulaNames: ["Circle", "Distance"],
      tipTitles: [
        "Calculator is better for decimal-heavy arithmetic",
        "Algebra is faster for symbolic cancellation",
      ],
    };
  }

  if (/(percent|ratio|probability|data|statistics|rate)/.test(t)) {
    return {
      title: "Data / Ratios / Percent",
      fastMove: "Translate wording into one equation before any calculations.",
      calculatorWhen: "Useful for chained percentages and repeated arithmetic trials.",
      algebraWhen: "Cross-multiplication and ratio simplification are often faster.",
      formulaNames: ["Exponent rules", "Slope"],
      tipTitles: [
        "Calculator is better for decimal-heavy arithmetic",
        "Algebra is faster for symbolic cancellation",
      ],
    };
  }

  return DEFAULT_PRESET;
}

function pickFormula(name: string): SatFormula | null {
  return SAT_FORMULAS.find((formula) => formula.name === name) ?? null;
}

function pickTip(title: string): SatMathToolTip | null {
  return SAT_CALCULATOR_STRATEGY.find((tip) => tip.title === title) ?? null;
}

function desmosStarterExpressions(topicHint?: string | null): string[] {
  const t = (topicHint || "").toLowerCase();
  if (/(linear|system|slope|line|intercept)/.test(t)) return ["y = mx + b", "y = ax + c"];
  if (/(quadratic|polynomial|parabola|roots?)/.test(t)) return ["y = ax^2 + bx + c", "y = 0"];
  if (/(circle|radius)/.test(t)) return ["(x - h)^2 + (y - k)^2 = r^2"];
  if (/(geometry|triangle|trig|angle)/.test(t)) return ["y = tan(theta)x", "x^2 + y^2 = r^2"];
  if (/(percent|ratio|probability|data|statistics|rate)/.test(t)) return ["y = kx", "y = a(1 + r)^x"];
  return ["y = f(x)", "y = g(x)"];
}

export default function MathToolsLayer({
  open,
  onClose,
  topicHint,
  modeLabel,
  strictExam = false,
}: MathToolsLayerProps) {
  const [tab, setTab] = useState<ToolTab>("topic");
  const preset = useMemo(() => topicPreset(topicHint), [topicHint]);
  const [desmosExpressions, setDesmosExpressions] = useState<string[]>(() =>
    desmosStarterExpressions(topicHint)
  );

  const recommendedFormulas = useMemo(
    () => preset.formulaNames.map((name) => pickFormula(name)).filter(Boolean) as SatFormula[],
    [preset.formulaNames]
  );
  const recommendedTips = useMemo(
    () => preset.tipTitles.map((title) => pickTip(title)).filter(Boolean) as SatMathToolTip[],
    [preset.tipTitles]
  );
  const starterExpressions = useMemo(() => desmosStarterExpressions(topicHint), [topicHint]);
  const desmosHref = "https://www.desmos.com/calculator";
  const [copiedExpressions, setCopiedExpressions] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDesmosExpressions(starterExpressions);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [starterExpressions]);

  if (!open) return null;

  async function copyExpressions() {
    try {
      await navigator.clipboard.writeText(desmosExpressions.join("\n"));
      setCopiedExpressions(true);
      window.setTimeout(() => setCopiedExpressions(false), 1400);
    } catch {
      setCopiedExpressions(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close math tools"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <aside className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-gray-200 bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[30rem] md:max-h-none md:rounded-none md:rounded-l-2xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                SAT Tool Console
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

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              { key: "topic", label: "Topic Quick" },
              { key: "formula", label: "Formulas" },
              { key: "strategy", label: "Calculator" },
              { key: "desmos", label: "Desmos" },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  tab === item.key
                    ? "border-[#0f1b33] bg-[#0f1b33] text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4">
          {strictExam && (
            <section className="rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                Exam shell behavior
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Bluebook-style utility mode: quick checks only, then return to the active question.
              </div>
            </section>
          )}

          {tab === "topic" && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Topic quick plan
              </div>
              <div className="mt-2 text-lg font-semibold text-black">{preset.title}</div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-semibold text-black">Fast SAT move:</span> {preset.fastMove}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-semibold text-black">Calculator helps when:</span> {preset.calculatorWhen}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-semibold text-black">Algebra is faster when:</span> {preset.algebraWhen}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Recommended formulas</div>
                  <div className="mt-2 grid gap-2">
                    {recommendedFormulas.map((formula) => (
                      <div key={formula.name} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="text-xs font-semibold text-black">{formula.name}</div>
                        <div className="mt-1 text-xs text-gray-700">{formula.formula}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Recommended tactics</div>
                  <div className="mt-2 grid gap-2">
                    {recommendedTips.map((tip) => (
                      <div key={tip.title} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="text-xs font-semibold text-black">{tip.title}</div>
                        <div className="mt-1 text-xs text-gray-700">{tip.quickRule}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === "formula" && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Formula reference
              </div>
              <div className="mt-3 grid gap-2">
                {SAT_FORMULAS.map((item) => (
                  <div key={item.name} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                    <div className="text-xs font-semibold text-black">{item.name}</div>
                    <div className="mt-1 text-sm font-medium text-[#0f172a]">{item.formula}</div>
                    {!strictExam && <div className="mt-1 text-xs text-gray-600">{item.when}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "strategy" && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Calculator / Desmos strategy
              </div>
              <div className="mt-3 grid gap-2">
                {SAT_CALCULATOR_STRATEGY.map((tip) => (
                  <div key={tip.title} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                    <div className="text-xs font-semibold text-black">{tip.title}</div>
                    <div className="mt-1 text-sm text-gray-800">{tip.quickRule}</div>
                    {!strictExam && (
                      <div className="mt-2 text-xs text-gray-600">
                        Use: {tip.doWhen}
                        <br />
                        Avoid: {tip.avoidWhen}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "desmos" && (
            <section className="rounded-2xl border border-[#b7d2ff] bg-[#f6faff] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">
                Desmos graph workspace
              </div>
              <div className="mt-2 text-sm font-semibold text-black">Set up the graph, then verify with a Bluebook-style calculator pass.</div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-[#c7dbff] bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Topic starter
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {starterExpressions.map((expr) => (
                      <button
                        key={expr}
                        onClick={() => setDesmosExpressions((prev) => [expr, ...prev.filter((item) => item !== expr)].slice(0, 4))}
                        className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-white"
                      >
                        {expr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#c7dbff] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                      Expression memory
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyExpressions}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                      >
                        {copiedExpressions ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => setDesmosExpressions(starterExpressions)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {desmosExpressions.slice(0, 4).map((expr, index) => (
                      <input
                        key={index}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-[#0f172a]"
                        value={expr}
                        onChange={(event) =>
                          setDesmosExpressions((prev) =>
                            prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                          )
                        }
                        aria-label={`Desmos expression ${index + 1}`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 text-xs leading-relaxed text-gray-600">
                    Copy expressions into the calculator below. Keep symbolic setup here so you do not lose the question.
                  </div>
                </div>

                <div className="rounded-xl border border-[#c7dbff] bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Utility actions
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <a
                      href={desmosHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Open full Desmos
                    </a>
                    <button
                      onClick={copyExpressions}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {copiedExpressions ? "Expressions copied" : "Copy expressions"}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#c7dbff] bg-white">
                  <iframe
                    title="Desmos graphing calculator"
                    src="https://www.desmos.com/calculator?embed&showGrid=true&showXAxis=true&showYAxis=true"
                    className="h-[420px] w-full"
                    loading="lazy"
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
