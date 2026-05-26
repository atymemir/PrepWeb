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

  if (text.includes("linear") || text.includes("system")) {
    return {
      formula: { name: "Slope", formula: "m = (y2 - y1) / (x2 - x1)" },
      calculatorTip: {
        title: "Graphing check for intersection",
        quickRule: "Use Desmos graph to verify candidate intersection quickly.",
      },
      fastMove: "Convert both equations to slope-intercept form before solving.",
      algebraFasterWhen: "Coefficients are small and elimination is one clean step.",
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
