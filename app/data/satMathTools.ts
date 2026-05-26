export type SatFormula = {
  name: string;
  formula: string;
  when: string;
};

export type SatMathToolTip = {
  title: string;
  quickRule: string;
  doWhen: string;
  avoidWhen: string;
};

export const SAT_FORMULAS: SatFormula[] = [
  { name: "Slope", formula: "m = (y2 - y1) / (x2 - x1)", when: "Comparing rate of change from two points." },
  { name: "Circle", formula: "(x - h)^2 + (y - k)^2 = r^2", when: "Center/radius geometry and coordinate questions." },
  { name: "Quadratic roots", formula: "x = (-b ± √(b^2 - 4ac)) / 2a", when: "Factoring stalls or coefficients are awkward." },
  { name: "Exponent rules", formula: "a^m * a^n = a^(m+n), (a^m)^n = a^(mn)", when: "Expression simplification under time pressure." },
  { name: "Distance", formula: "d = √((x2-x1)^2 + (y2-y1)^2)", when: "Coordinate geometry length checks." },
];

export const SAT_CALCULATOR_STRATEGY: SatMathToolTip[] = [
  {
    title: "Calculator is better for decimal-heavy arithmetic",
    quickRule: "Use calculator when the bottleneck is raw arithmetic, not structure.",
    doWhen: "Large multiplications, long decimals, or repeated numeric trial.",
    avoidWhen: "You still have unknown structure to simplify first.",
  },
  {
    title: "Algebra is faster for symbolic cancellation",
    quickRule: "If terms cancel cleanly, algebra beats key presses.",
    doWhen: "Factor/cancel patterns, linear isolation, proportion simplification.",
    avoidWhen: "Messy numerical substitution dominates the remaining steps.",
  },
  {
    title: "Desmos wins for visual intersection checks",
    quickRule: "Graph both expressions to estimate or verify roots/intersections.",
    doWhen: "Comparing function behavior or testing multiple candidate roots.",
    avoidWhen: "A direct one-line algebra move gives exact value faster.",
  },
];
