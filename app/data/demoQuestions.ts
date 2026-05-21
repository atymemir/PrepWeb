export type DemoQuestion = {
  id: string;
  subject: "Reading" | "Math";
  subskill: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
};

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: "rw-1",
    subject: "Reading",
    subskill: "Words in Context",
    question_text:
      "The committee’s decision was widely praised because it was both practical and ______, addressing immediate needs without ignoring long-term consequences.",
    option_a: "rash",
    option_b: "measured",
    option_c: "vague",
    option_d: "arbitrary",
    correct_option: "B",
    explanation:
      "The sentence praises the decision as practical and responsible. 'Measured' best fits that positive, careful tone.",
  },
  {
    id: "rw-2",
    subject: "Reading",
    subskill: "Transitions",
    question_text:
      "The new recycling policy was expensive to implement initially. ______, city officials expect it to reduce waste-management costs over time.",
    option_a: "For example",
    option_b: "However",
    option_c: "Therefore",
    option_d: "Similarly",
    correct_option: "B",
    explanation:
      "The second sentence contrasts short-term expense with long-term savings, so 'However' is correct.",
  },
  {
    id: "rw-3",
    subject: "Reading",
    subskill: "Boundaries",
    question_text:
      "The researchers repeated the experiment several times, ______ the initial results had been surprising.",
    option_a: "because",
    option_b: "therefore",
    option_c: "moreover",
    option_d: "nevertheless",
    correct_option: "A",
    explanation:
      "The second part explains why the experiment was repeated. 'Because' correctly introduces the reason.",
  },
  {
    id: "rw-4",
    subject: "Reading",
    subskill: "Central Ideas and Details",
    question_text:
      "A passage explains that urban tree planting can reduce heat, improve air quality, and make neighborhoods more walkable. Which choice best states the main idea?",
    option_a: "Urban trees are expensive and difficult to maintain.",
    option_b: "Urban trees provide several environmental and social benefits.",
    option_c: "Air quality is the only reason cities should plant trees.",
    option_d: "Most cities have already solved heat-related problems.",
    correct_option: "B",
    explanation:
      "The passage lists multiple benefits, so the best main idea is that urban trees provide several benefits.",
  },
  {
    id: "math-1",
    subject: "Math",
    subskill: "Linear Equations in One Variable",
    question_text: "Solve for x: 3(x - 2) = 2x + 7",
    option_a: "11",
    option_b: "12",
    option_c: "13",
    option_d: "14",
    correct_option: "C",
    explanation:
      "Expand: 3x - 6 = 2x + 7. Subtract 2x: x - 6 = 7. Add 6: x = 13.",
  },
  {
    id: "math-2",
    subject: "Math",
    subskill: "Systems of Linear Equations",
    question_text:
      "What is the solution to the system?\n\nx + y = 9\nx - y = 3",
    option_a: "(6, 3)",
    option_b: "(3, 6)",
    option_c: "(9, 0)",
    option_d: "(0, 9)",
    correct_option: "A",
    explanation:
      "Add the equations: 2x = 12, so x = 6. Then y = 3.",
  },
  {
    id: "math-3",
    subject: "Math",
    subskill: "Ratios, Rates, and Percent",
    question_text:
      "A jacket’s price increased from $80 to $100. What is the percent increase?",
    option_a: "20%",
    option_b: "25%",
    option_c: "30%",
    option_d: "40%",
    correct_option: "B",
    explanation:
      "Increase = 20. Percent increase = 20/80 = 0.25 = 25%.",
  },
  {
    id: "math-4",
    subject: "Math",
    subskill: "Quadratics and Polynomials",
    question_text:
      "Which value of x is a solution to x² - 5x + 6 = 0?",
    option_a: "1",
    option_b: "2",
    option_c: "4",
    option_d: "5",
    correct_option: "B",
    explanation:
      "Factor: (x - 2)(x - 3) = 0, so solutions are 2 and 3. Among the choices, 2 appears.",
  },
];