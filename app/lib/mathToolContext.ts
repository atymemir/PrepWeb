import { SAT_CALCULATOR_STRATEGY, SAT_FORMULAS } from "../data/satMathTools";

export type MathLessonToolContext = {
  formula: { name: string; formula: string };
  calculatorTip: { title: string; quickRule: string };
  fastMove: string;
  algebraFasterWhen: string;
};

const DEFAULT_CONTEXT: MathLessonToolContext = {
  formula: { name: SAT_FORMULAS[0].name, formula: SAT_FORMULAS[0].formula },
  calculatorTip: {
    title: SAT_CALCULATOR_STRATEGY[0].title,
    quickRule: SAT_CALCULATOR_STRATEGY[0].quickRule,
  },
  fastMove: "Reduce structure first, then compute.",
  algebraFasterWhen: "Patterns cancel cleanly before substitution.",
};

function textOf(lesson: { key: string; title: string; domain?: string }): string {
  return `${lesson.key} ${lesson.title} ${lesson.domain ?? ""}`.toLowerCase();
}

export function mathLessonToolContext(lesson: {
  key: string;
  title: string;
  subject?: "Reading" | "Math";
  domain?: string;
}): MathLessonToolContext | null {
  const text = textOf(lesson);
  const looksMath =
    lesson.subject === "Math" ||
    /(math|algebra|equation|linear|system|quadratic|polynomial|geometry|circle|triangle|trig|ratio|percent|probability|data)/.test(
      text
    );
  if (!looksMath) return null;

  if (text.includes("linear equations in one variable")) {
    return {
      formula: { name: "Linear solve pattern", formula: "ax + b = c  ->  x = (c - b) / a" },
      calculatorTip: {
        title: "Algebra-first check",
        quickRule: "Solve symbolically first, then verify by substitution.",
      },
      fastMove: "Distribute carefully, collect x-terms, then isolate with balanced operations.",
      algebraFasterWhen: "Coefficients are clean and sign control is the main risk.",
    };
  }

  if (text.includes("linear inequalities")) {
    return {
      formula: { name: "Inequality flip rule", formula: "Multiply or divide by a negative  ->  flip inequality sign" },
      calculatorTip: {
        title: "Number-line verification",
        quickRule: "Test one value from the proposed solution interval.",
      },
      fastMove: "Solve like an equation, then check whether the final step requires a sign flip.",
      algebraFasterWhen: "Single-variable form with clear endpoint behavior.",
    };
  }

  if (text.includes("linear equations in two variables")) {
    return {
      formula: { name: "Slope", formula: "m = (y2 - y1) / (x2 - x1)" },
      calculatorTip: {
        title: "Slope-intercept scan",
        quickRule: "Convert to y = mx + b before interpreting rate and intercept.",
      },
      fastMove: "Read slope and intercept meaning before doing any arithmetic.",
      algebraFasterWhen: "Question asks for rate, intercept, or whether a point satisfies the line.",
    };
  }

  if (text.includes("systems of linear equations") || text.includes("system")) {
    return {
      formula: { name: "System intersection", formula: "Solve both equations simultaneously for one ordered pair" },
      calculatorTip: {
        title: "Graphing check for intersection",
        quickRule: "Use Desmos graph to verify candidate intersection quickly.",
      },
      fastMove: "Choose elimination when coefficients align; substitution when one variable is isolated.",
      algebraFasterWhen: "Coefficients are small and elimination is one clean step.",
    };
  }

  if (text.includes("functions and notation")) {
    return {
      formula: { name: "Function substitution", formula: "f(input) = replace every x in f(x) with input" },
      calculatorTip: {
        title: "Parentheses discipline",
        quickRule: "When input is an expression, wrap it in parentheses everywhere.",
      },
      fastMove: "Say 'replace every x' before writing the first substitution line.",
      algebraFasterWhen: "Expression structure is simple and direct substitution avoids graphing.",
    };
  }

  if (text.includes("quadratic") || text.includes("polynomial")) {
    return {
      formula: { name: "Quadratic roots", formula: "x = (-b ± √(b^2 - 4ac)) / 2a" },
      calculatorTip: {
        title: "Desmos root confirmation",
        quickRule: "Graph once to check if your algebraic roots match x-intercepts.",
      },
      fastMove: "Check factoring pattern before jumping to formula.",
      algebraFasterWhen: "Expression factors into small integers immediately.",
    };
  }

  if (text.includes("exponents") || text.includes("radicals")) {
    return {
      formula: { name: "Exponent rules", formula: "a^m * a^n = a^(m+n),  (a^m)^n = a^(mn),  a^m / a^n = a^(m-n)" },
      calculatorTip: {
        title: "Exact-form guardrail",
        quickRule: "Avoid decimal approximations until the final step.",
      },
      fastMove: "Match bases first, then apply one exponent rule at a time.",
      algebraFasterWhen: "Expressions can be simplified structurally before numeric evaluation.",
    };
  }

  if (text.includes("geometry") || text.includes("circle") || text.includes("triangle") || text.includes("trig")) {
    return {
      formula: { name: "Circle", formula: "(x - h)^2 + (y - k)^2 = r^2" },
      calculatorTip: {
        title: "Calculator for decimal geometry",
        quickRule: "Use calculator only after symbolic setup is finished.",
      },
      fastMove: "Sketch the figure and label known values before any arithmetic.",
      algebraFasterWhen: "Ratios and special triangles simplify exactly.",
    };
  }

  if (text.includes("data analysis and probability")) {
    return {
      formula: { name: "Probability", formula: "P(event) = favorable outcomes / total outcomes" },
      calculatorTip: {
        title: "Table/axis discipline",
        quickRule: "Read labels and units before reading values.",
      },
      fastMove: "Name numerator and denominator out loud before calculating.",
      algebraFasterWhen: "Question asks for direct probability, mean, or weighted count from visible data.",
    };
  }

  if (text.includes("ratio") || text.includes("percent") || text.includes("data") || text.includes("probability")) {
    return {
      formula: { name: "Percent change", formula: "new = old * (1 ± r)" },
      calculatorTip: {
        title: "Use calculator for chained percentages",
        quickRule: "Multiple percent updates are calculator-friendly.",
      },
      fastMove: "Convert words to one equation before computing.",
      algebraFasterWhen: "Proportion setup has easy cross-multiplication.",
    };
  }

  return DEFAULT_CONTEXT;
}
