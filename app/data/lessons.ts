export type Lesson = {
  key: string;
  subject: "Reading" | "Math";
  domain: string;
  title: string;
  summary: string;
  keyPoints: string[];
  commonTraps: string[];
  miniExample: { prompt: string; answer: string };
  repairPattern: string[];
  decisionRules: string[];
  satMoves: string[];
  microDrill: {
    prompt: string;
    steps: string[];
    answer: string;
  };
  practiceCue: string;
};

export const LESSONS: Lesson[] = [
  {
    key: "Words in Context",
    subject: "Reading",
    domain: "Craft and Structure",
    title: "Words in Context",
    summary: "Choose the meaning created by the sentence, not the fanciest dictionary meaning.",
    keyPoints: [
      "Cover the answer choices and name the role the missing word plays.",
      "Use nearby verbs, objects, and contrast words as hard evidence.",
      "Prefer the choice that matches the author's logic and tone exactly.",
    ],
    commonTraps: [
      "A familiar definition that ignores the sentence",
      "A word with the right tone but the wrong action",
      "A choice that is too emotional for a neutral academic passage",
    ],
    miniExample: {
      prompt: "The plan was praised because it was practical and measured.",
      answer: "Measured means careful and restrained, not mathematical or large.",
    },
    repairPattern: [
      "Name the blank: attitude, action, degree, or relationship.",
      "Write a plain replacement word before looking at choices.",
      "Reject choices that do not fit the sentence's concrete action.",
    ],
    decisionRules: [
      "If two choices both sound plausible, test each in the exact sentence.",
      "If the passage contrasts two ideas, the word must preserve that contrast.",
      "If the text is academic, avoid choices that add drama the author did not create.",
    ],
    satMoves: [
      "Circle contrast signals: however, although, despite, while.",
      "Use the object after the verb as the strongest clue.",
      "Translate the sentence into a simpler version before choosing.",
    ],
    microDrill: {
      prompt:
        "The scientist's conclusion was cautious rather than ______; she noted that the data suggested a trend but did not prove it.",
      steps: [
        "The contrast is cautious versus too certain.",
        "The second clause says the data suggests, not proves.",
        "The answer should mean overconfident or sweeping.",
      ],
      answer: "A word like definitive, absolute, or conclusive would fit the logic.",
    },
    practiceCue: "Run a targeted block and force yourself to predict the missing meaning before reading choices.",
  },
  {
    key: "Text Structure and Purpose",
    subject: "Reading",
    domain: "Craft and Structure",
    title: "Text Structure and Purpose",
    summary: "Track why each sentence exists: claim, evidence, contrast, example, concession, or result.",
    keyPoints: [
      "Label each sentence by job, not topic.",
      "Purpose questions usually ask what the author is doing, not what the passage is about.",
      "Structure answers should describe the movement of ideas in order.",
    ],
    commonTraps: [
      "A true detail that does not describe purpose",
      "A purpose that is too broad for one sentence",
      "A choice that reverses example and conclusion",
    ],
    miniExample: {
      prompt: "A passage introduces a theory, gives a study that challenges it, then explains the new model.",
      answer: "The structure moves from old explanation to conflicting evidence to revised explanation.",
    },
    repairPattern: [
      "Mark the sentence before and after the target.",
      "Ask what would break if the target sentence were removed.",
      "Choose the answer that names the sentence's function in the argument.",
    ],
    decisionRules: [
      "If the sentence contains an example, ask what claim it supports.",
      "If it starts with a contrast signal, the purpose is usually to qualify or challenge.",
      "If answer choices mention content only, prefer the one that also captures function.",
    ],
    satMoves: [
      "Use one-word job labels in the margin: claim, example, contrast, result.",
      "Ignore answer choices that summarize only half the sentence.",
      "For whole-passage structure, map the first and last sentence first.",
    ],
    microDrill: {
      prompt:
        "Sentence 1: Some critics saw the film as derivative. Sentence 2: Recent archival research, however, shows its editing techniques were unusual for the period.",
      steps: [
        "Sentence 1 gives an existing view.",
        "However introduces a challenge.",
        "Sentence 2 uses evidence to revise the earlier view.",
      ],
      answer: "Sentence 2 challenges a prior assessment by presenting contrary evidence.",
    },
    practiceCue: "In practice, say the sentence job out loud before looking at the answer choices.",
  },
  {
    key: "Cross-Text Connections",
    subject: "Reading",
    domain: "Craft and Structure",
    title: "Cross-Text Connections",
    summary: "Compare the two authors' claims, assumptions, and likely reactions without blending them.",
    keyPoints: [
      "Read Text 1 for position, then Text 2 for position.",
      "Write a short relation: agrees, disagrees, qualifies, or extends.",
      "Reaction answers must be supported by Text 2's stated view.",
    ],
    commonTraps: [
      "Mixing the two authors into one position",
      "Choosing an answer based on tone instead of claim",
      "Overstating disagreement when Text 2 only adds nuance",
    ],
    miniExample: {
      prompt: "Text 1 says a policy worked because costs fell. Text 2 says costs fell mostly because demand changed.",
      answer: "Text 2 would likely argue Text 1 overstates the policy's effect.",
    },
    repairPattern: [
      "Underline each author's main claim separately.",
      "Write T2 -> T1 in five words or fewer.",
      "Choose the answer that preserves both positions.",
    ],
    decisionRules: [
      "If Text 2 adds a different cause, it usually qualifies Text 1.",
      "If Text 2 accepts the result but disputes the explanation, avoid total-disagreement answers.",
      "If an answer needs outside knowledge, eliminate it.",
    ],
    satMoves: [
      "Use arrows: T2 supports, challenges, narrows, or extends T1.",
      "Watch for may, some, often, and likely; degree matters.",
      "Test reaction answers by asking: would this author actually say that?",
    ],
    microDrill: {
      prompt:
        "Text 1 claims urban gardens improve diets. Text 2 says studies show stronger effects on neighborhood cohesion than on diet.",
      steps: [
        "Text 1 emphasizes diet.",
        "Text 2 does not deny benefits, but shifts the strongest effect.",
        "The relationship is qualification.",
      ],
      answer: "Text 2 would likely say Text 1 identifies a benefit but overemphasizes the dietary effect.",
    },
    practiceCue: "Use a two-column scratch note for every cross-text item: T1 claim, T2 claim, relationship.",
  },
  {
    key: "Central Ideas and Details",
    subject: "Reading",
    domain: "Information and Ideas",
    title: "Central Ideas and Details",
    summary: "Separate the passage's main point from details that merely support it.",
    keyPoints: [
      "The central idea must cover the whole passage, not one sentence.",
      "Details questions require exact support, not a reasonable guess.",
      "Main idea answers are usually moderate and complete.",
    ],
    commonTraps: [
      "A true detail presented as the main idea",
      "An answer that includes one unsupported extra claim",
      "Extreme wording that goes beyond the text",
    ],
    miniExample: {
      prompt: "A text lists heat reduction, cleaner air, and walkability benefits of urban trees.",
      answer: "The central idea is that urban trees provide several environmental and social benefits.",
    },
    repairPattern: [
      "Find the topic, then find what the author says about it.",
      "Check whether the answer covers the beginning and end.",
      "For detail questions, point to the exact line of evidence before choosing.",
    ],
    decisionRules: [
      "If the answer is true but narrow, eliminate it for main idea.",
      "If the answer adds a claim not in the text, eliminate it even if it sounds reasonable.",
      "If two answers compete, prefer the one that includes the author's actual emphasis.",
    ],
    satMoves: [
      "Summarize the passage in one sentence before reading choices.",
      "Treat adjectives in answer choices as evidence requirements.",
      "Watch for 'primarily' and 'mainly'; they ask for scope.",
    ],
    microDrill: {
      prompt:
        "A passage explains that a marine sensor is cheaper, easier to deploy, and accurate in rough water.",
      steps: [
        "The topic is the marine sensor.",
        "The author lists multiple advantages.",
        "The main idea must include usefulness, not only cost.",
      ],
      answer: "The sensor offers several practical advantages for ocean research.",
    },
    practiceCue: "Before every answer, ask whether the choice is too narrow, too broad, or just right.",
  },
  {
    key: "Inferences",
    subject: "Reading",
    domain: "Information and Ideas",
    title: "Inferences",
    summary: "Pick what must be true from the text, not what could be interesting or likely in real life.",
    keyPoints: [
      "Inference means supported extension, not speculation.",
      "Strong answers usually restate evidence in a new form.",
      "The correct choice survives a strict evidence test.",
    ],
    commonTraps: [
      "A plausible real-world claim with no textual proof",
      "A choice that uses a stronger word than the passage supports",
      "A reversed relationship between cause and effect",
    ],
    miniExample: {
      prompt: "Native seed-spreading birds are extinct, but introduced birds now spread many seeds.",
      answer: "Some plants may now depend on introduced birds for seed dispersal.",
    },
    repairPattern: [
      "Find the sentence that does the work.",
      "Translate it into a must-be-true statement.",
      "Reject any answer that needs an extra assumption.",
    ],
    decisionRules: [
      "If the answer says all, always, never, or only, demand exact proof.",
      "If the passage says may, the answer cannot become definitely.",
      "If the answer explains why but the passage only says what, eliminate it.",
    ],
    satMoves: [
      "Use the 'prove it from the text' test.",
      "Prefer modest language unless the text is absolute.",
      "Check that nouns in the answer match the same group in the passage.",
    ],
    microDrill: {
      prompt:
        "A study found that students who spaced practice over several days remembered more than students who studied the same amount in one evening.",
      steps: [
        "Same total study time removes volume as the explanation.",
        "The difference is distribution over time.",
        "The inference should be about spacing improving retention.",
      ],
      answer: "How study time is distributed can affect retention, even when total time is unchanged.",
    },
    practiceCue: "For misses, write the extra assumption you accidentally added.",
  },
  {
    key: "Command of Evidence",
    subject: "Reading",
    domain: "Information and Ideas",
    title: "Command of Evidence",
    summary: "Match claims to the exact data, quote, or detail that proves them.",
    keyPoints: [
      "Evidence answers must support the claim directly.",
      "Data questions require direction and size, not just topic match.",
      "The best evidence often uses the same relationship as the claim.",
    ],
    commonTraps: [
      "A quote about the same topic that proves a different claim",
      "A graph answer that reverses increase and decrease",
      "A detail that supports only part of the claim",
    ],
    miniExample: {
      prompt: "Claim: the method reduced water use. Data: Farm A used 30% less water after adopting it.",
      answer: "The data supports the claim because it shows lower water use after adoption.",
    },
    repairPattern: [
      "Underline the claim's verb: increases, reduces, challenges, supports.",
      "Find evidence with the same relationship.",
      "Check that every part of the claim is proven.",
    ],
    decisionRules: [
      "If evidence is merely related, it is not enough.",
      "If a graph has two variables, name both before choosing.",
      "If the claim compares groups, the evidence must compare the same groups.",
    ],
    satMoves: [
      "Translate charts into one sentence before reading choices.",
      "Use units and labels as guardrails.",
      "Eliminate choices that cite data but draw the wrong conclusion.",
    ],
    microDrill: {
      prompt:
        "Claim: Compost increased tomato yield more than fertilizer B. Data: Compost +18%, fertilizer B +9%, control 0%.",
      steps: [
        "The claim compares compost to fertilizer B.",
        "Compost has a larger increase.",
        "The correct evidence names the larger gain.",
      ],
      answer: "Compost produced twice the yield increase of fertilizer B.",
    },
    practiceCue: "When reviewing, identify whether you missed the claim, the evidence, or the comparison.",
  },
  {
    key: "Boundaries",
    subject: "Reading",
    domain: "Standard English Conventions",
    title: "Boundaries",
    summary: "Control sentence joins: complete thought, fragment, comma splice, colon, dash, and semicolon.",
    keyPoints: [
      "A complete thought has a subject and a working verb.",
      "Semicolons join two complete thoughts.",
      "Colons and dashes introduce an explanation, example, or restatement after a complete setup.",
    ],
    commonTraps: [
      "Using a comma to join two complete thoughts",
      "Putting a semicolon before a fragment",
      "Choosing punctuation by pause instead of grammar",
    ],
    miniExample: {
      prompt: "The team revised the design ___ the first prototype had failed.",
      answer: "Because works if the second part explains the reason.",
    },
    repairPattern: [
      "Bracket the words before and after the punctuation.",
      "Label each side complete or incomplete.",
      "Choose the punctuation that legally joins those pieces.",
    ],
    decisionRules: [
      "Complete + complete can use semicolon, period, or comma plus FANBOYS.",
      "Complete + explanation can use colon or dash.",
      "Dependent clause + complete thought usually needs a comma only when the dependent clause comes first.",
    ],
    satMoves: [
      "Ignore how the sentence sounds; test grammar mechanically.",
      "For colon questions, check that the left side can stand alone.",
      "For dash pairs, make sure the interruption can be removed.",
    ],
    microDrill: {
      prompt: "The archive contained one unexpected item ___ a handwritten map of the river.",
      steps: [
        "The left side is a complete setup.",
        "The right side explains the item.",
        "A colon fits complete setup + explanation.",
      ],
      answer: "Use a colon: item: a handwritten map of the river.",
    },
    practiceCue: "For every miss, label both sides complete or fragment before reading the explanation.",
  },
  {
    key: "Form, Structure, and Sense",
    subject: "Reading",
    domain: "Standard English Conventions",
    title: "Form, Structure, and Sense",
    summary: "Make the sentence grammatically complete and logically smooth without changing its meaning.",
    keyPoints: [
      "Check subject-verb agreement first.",
      "Match pronouns to clear nouns and correct number.",
      "Verb tense should fit the time logic of the sentence.",
    ],
    commonTraps: [
      "A nearby noun tricking you into wrong verb agreement",
      "A pronoun with no clear antecedent",
      "A tense shift that sounds natural but breaks chronology",
    ],
    miniExample: {
      prompt: "The collection of essays ___ a wide range of topics.",
      answer: "Uses is correct because the subject is collection, not essays.",
    },
    repairPattern: [
      "Find the true subject, not the closest noun.",
      "Remove interrupting phrases mentally.",
      "Check whether the answer preserves the original meaning.",
    ],
    decisionRules: [
      "Prepositional phrases rarely contain the subject.",
      "If two verbs describe the same time, keep tense parallel.",
      "If a modifier opens the sentence, the next noun should be what it describes.",
    ],
    satMoves: [
      "Cross out phrases between commas to expose the core sentence.",
      "Read only subject + verb to test agreement.",
      "For modifiers, ask who or what performed the opening action.",
    ],
    microDrill: {
      prompt: "Walking through the lab, the samples were labeled by Mira.",
      steps: [
        "The opening modifier says someone was walking.",
        "Samples cannot walk through the lab.",
        "Mira must appear right after the modifier.",
      ],
      answer: "Walking through the lab, Mira labeled the samples.",
    },
    practiceCue: "Slow down on grammar items: most misses come from choosing by ear too early.",
  },
  {
    key: "Transitions",
    subject: "Reading",
    domain: "Expression of Ideas",
    title: "Transitions",
    summary: "Choose the connector that matches the relationship between two ideas.",
    keyPoints: [
      "Identify the relationship before checking choices: contrast, cause, example, addition, result.",
      "Transitions are logic words, not style words.",
      "Read one sentence before and after the blank.",
    ],
    commonTraps: [
      "Choosing a transition because it sounds academic",
      "Missing a contrast hidden after a positive opening",
      "Using therefore when the second sentence is evidence, not a result",
    ],
    miniExample: {
      prompt: "The policy was expensive at first. ___ officials expect it to save money later.",
      answer: "However, because the second sentence contrasts short-term cost with later savings.",
    },
    repairPattern: [
      "Write the relationship in one word.",
      "Group answer choices by function.",
      "Choose the connector that preserves the relationship exactly.",
    ],
    decisionRules: [
      "However signals contrast.",
      "Therefore signals result.",
      "For example signals evidence or illustration.",
    ],
    satMoves: [
      "Cover the choices and write contrast/addition/result/example in the margin.",
      "Check whether the second sentence moves with or against the first.",
      "Do not let topic similarity trick you into an addition transition.",
    ],
    microDrill: {
      prompt: "The device was smaller than earlier models. ___ it used less power.",
      steps: [
        "The second sentence adds another advantage.",
        "There is no contrast or cause stated.",
        "An addition transition fits.",
      ],
      answer: "Additionally or moreover fits the relationship.",
    },
    practiceCue: "On review, write the missed relationship label next to the transition.",
  },
  {
    key: "Rhetorical Synthesis",
    subject: "Reading",
    domain: "Expression of Ideas",
    title: "Rhetorical Synthesis",
    summary: "Use the notes to fulfill the stated goal, not to summarize everything.",
    keyPoints: [
      "Read the goal before the notes.",
      "Select only notes that serve that goal.",
      "The correct answer usually combines the right facts in a clean sentence.",
    ],
    commonTraps: [
      "An answer that is true but does not address the goal",
      "A sentence that includes too many unrelated notes",
      "A comparison answer when the goal asks for chronology or significance",
    ],
    miniExample: {
      prompt: "Goal: emphasize a scientist's influence. Notes: won award, trained later researchers, worked in 1980s.",
      answer: "Use the trained later researchers note because it directly shows influence.",
    },
    repairPattern: [
      "Underline the task verb: introduce, compare, emphasize, illustrate.",
      "Cross out notes that do not serve the task.",
      "Pick the answer with the right rhetorical function, even if another answer is true.",
    ],
    decisionRules: [
      "If the goal says compare, both items must appear.",
      "If the goal says emphasize importance, choose impact over biography.",
      "If the goal says introduce, the answer should orient the reader clearly.",
    ],
    satMoves: [
      "Treat the notes as a parts bin, not a paragraph to compress.",
      "Check the answer's first few words for the requested function.",
      "Eliminate overloaded choices that lose the goal.",
    ],
    microDrill: {
      prompt:
        "Goal: show that a museum's archive is broad. Notes: includes letters, maps, recordings, and tools; opened in 1978; has six staff members.",
      steps: [
        "Broad means range.",
        "The archive contents prove range.",
        "Opening year and staff count do not serve the goal.",
      ],
      answer: "The archive is broad, containing letters, maps, recordings, and tools.",
    },
    practiceCue: "For each miss, ask whether you answered the notes or answered the goal.",
  },
  {
    key: "Linear Equations in One Variable",
    subject: "Math",
    domain: "Algebra",
    title: "Linear Equations in One Variable",
    summary: "Isolate the variable cleanly; most SAT traps are distribution, signs, and fractions.",
    keyPoints: [
      "Distribute before combining like terms.",
      "Clear fractions only if it makes the equation simpler.",
      "Whatever you do to one side, do to the other side.",
    ],
    commonTraps: [
      "Dropping a negative when distributing",
      "Combining unlike terms",
      "Clearing denominators on only one term",
    ],
    miniExample: {
      prompt: "Solve 3(x - 2) = 2x + 7.",
      answer: "3x - 6 = 2x + 7, so x = 13.",
    },
    repairPattern: [
      "Expand carefully.",
      "Move variables to one side and constants to the other.",
      "Check by substituting your answer into the original equation.",
    ],
    decisionRules: [
      "If coefficients are small, algebra is faster than plugging choices.",
      "If choices are numeric and algebra gets messy, plug choices strategically.",
      "If the same variable appears on both sides, collect before dividing.",
    ],
    satMoves: [
      "Use a vertical line down the equals sign to protect balance.",
      "Circle negative signs before distributing.",
      "Back-solve only when the answer choices are clean.",
    ],
    microDrill: {
      prompt: "Solve 5 - 2(x + 3) = 11.",
      steps: [
        "Distribute: 5 - 2x - 6 = 11.",
        "Combine: -2x - 1 = 11.",
        "Add 1, then divide by -2.",
      ],
      answer: "x = -6.",
    },
    practiceCue: "In targeted practice, substitute every final answer back into the original for one block.",
  },
  {
    key: "Linear Equations in Two Variables",
    subject: "Math",
    domain: "Algebra",
    title: "Linear Equations in Two Variables",
    summary: "Read slope, intercept, and point meaning from the equation before calculating.",
    keyPoints: [
      "Slope is rate of change.",
      "The y-intercept is the value when x = 0.",
      "A point is a solution only if it satisfies the equation.",
    ],
    commonTraps: [
      "Confusing x-intercept and y-intercept",
      "Reading slope from standard form without rearranging",
      "Forgetting that units define the meaning of slope",
    ],
    miniExample: {
      prompt: "For y = 4x + 7, what does 4 represent?",
      answer: "For every 1 increase in x, y increases by 4.",
    },
    repairPattern: [
      "Put the equation in y = mx + b when slope/intercept matter.",
      "Translate m and b into the problem's units.",
      "Test points by substitution, not by graph shape alone.",
    ],
    decisionRules: [
      "If the question asks rate, find slope.",
      "If it asks starting value, find intercept.",
      "If it asks whether a pair works, substitute x and y.",
    ],
    satMoves: [
      "For standard form Ax + By = C, solve for y before reading slope.",
      "Use two points only when no equation form is given.",
      "Keep units attached to numbers.",
    ],
    microDrill: {
      prompt: "A line models cost y = 12x + 30. What does 30 mean?",
      steps: [
        "30 is the y-value when x = 0.",
        "In a cost model, that is the starting cost.",
        "12 is the added cost per unit.",
      ],
      answer: "The fixed starting cost is 30 dollars.",
    },
    practiceCue: "Write slope and intercept meanings before solving each word problem.",
  },
  {
    key: "Systems of Linear Equations",
    subject: "Math",
    domain: "Algebra",
    title: "Systems of Linear Equations",
    summary: "Use elimination, substitution, or graphing based on which move is cleanest.",
    keyPoints: [
      "A solution is the point that satisfies both equations.",
      "Elimination is fastest when coefficients already match or nearly match.",
      "Substitution is fastest when one variable is already isolated.",
    ],
    commonTraps: [
      "Solving one equation and forgetting the other",
      "Arithmetic sign errors during elimination",
      "Misreading no solution versus infinitely many solutions",
    ],
    miniExample: {
      prompt: "x + y = 9 and x - y = 3.",
      answer: "Add equations: 2x = 12, x = 6, y = 3.",
    },
    repairPattern: [
      "Choose method based on equation shape.",
      "Solve for one variable.",
      "Plug back into either original equation and verify both.",
    ],
    decisionRules: [
      "Same slope, different intercept means no solution.",
      "Same line written differently means infinitely many solutions.",
      "If choices are points, substitution may beat full solving.",
    ],
    satMoves: [
      "Add or subtract equations only after aligning variables.",
      "Use Desmos to verify intersections after algebra.",
      "For word systems, define variables before writing equations.",
    ],
    microDrill: {
      prompt: "Solve 2x + y = 10 and 2x - y = 2.",
      steps: [
        "Add equations: 4x = 12.",
        "x = 3.",
        "Substitute: 6 + y = 10.",
      ],
      answer: "(3, 4).",
    },
    practiceCue: "After each solve, verify the ordered pair in both equations.",
  },
  {
    key: "Linear Inequalities",
    subject: "Math",
    domain: "Algebra",
    title: "Linear Inequalities",
    summary: "Solve like equations, but protect the inequality direction and graph meaning.",
    keyPoints: [
      "Flip the inequality only when multiplying or dividing by a negative.",
      "Open circles exclude endpoints; closed circles include endpoints.",
      "And means overlap; or means union.",
    ],
    commonTraps: [
      "Forgetting to flip after dividing by a negative",
      "Choosing the wrong endpoint circle",
      "Treating compound inequalities as one-sided",
    ],
    miniExample: {
      prompt: "-2x > 8",
      answer: "Divide by -2 and flip: x < -4.",
    },
    repairPattern: [
      "Solve the inequality mechanically.",
      "Mark whether the endpoint is included.",
      "Test a simple number to confirm the direction.",
    ],
    decisionRules: [
      "If the variable coefficient is negative at the final divide, flip.",
      "If the inequality has <= or >=, use a closed endpoint.",
      "If choices are graphs, test a point on the shaded side.",
    ],
    satMoves: [
      "Write FLIP above any negative division.",
      "Use zero as a test point when possible.",
      "For systems of inequalities, find the region satisfying both.",
    ],
    microDrill: {
      prompt: "Solve 7 - 3x <= 16.",
      steps: [
        "Subtract 7: -3x <= 9.",
        "Divide by -3 and flip.",
        "x >= -3.",
      ],
      answer: "x >= -3.",
    },
    practiceCue: "For one block, test a value after every inequality solve.",
  },
  {
    key: "Functions and Notation",
    subject: "Math",
    domain: "Advanced Math",
    title: "Functions and Notation",
    summary: "Treat function notation as input-output instructions, not as decoration.",
    keyPoints: [
      "f(3) means the output when x = 3.",
      "f(x + 2) means replace every x with x + 2.",
      "Composition means one function's output becomes another function's input.",
    ],
    commonTraps: [
      "Multiplying f by the input instead of substituting",
      "Replacing only one x in an expression",
      "Reversing composition order",
    ],
    miniExample: {
      prompt: "If f(x) = 2x + 5, find f(4).",
      answer: "2(4) + 5 = 13.",
    },
    repairPattern: [
      "Identify the input.",
      "Replace every x with that input using parentheses.",
      "Simplify after substitution.",
    ],
    decisionRules: [
      "If the input has an expression, use parentheses around it.",
      "If the question asks for x when f(x) = k, solve an equation.",
      "If there is a graph, read input on x-axis and output on y-axis.",
    ],
    satMoves: [
      "Write f(__) as a machine: input in, output out.",
      "For composition, work from the inside function outward.",
      "Use tables to track repeated substitutions.",
    ],
    microDrill: {
      prompt: "If f(x) = x^2 - 1, find f(a + 3).",
      steps: [
        "Replace x with a + 3.",
        "Use parentheses: (a + 3)^2 - 1.",
        "Expand only if needed.",
      ],
      answer: "(a + 3)^2 - 1.",
    },
    practiceCue: "During practice, say 'replace every x' before touching function questions.",
  },
  {
    key: "Quadratics and Polynomials",
    subject: "Math",
    domain: "Advanced Math",
    title: "Quadratics and Polynomials",
    summary: "Look for structure first: factoring, roots, vertex, intercepts, or equivalent forms.",
    keyPoints: [
      "Factored form reveals roots.",
      "Vertex form reveals maximum or minimum.",
      "Expanded form helps combine and compare coefficients.",
    ],
    commonTraps: [
      "Using the quadratic formula when factoring is immediate",
      "Forgetting that roots make the expression equal zero",
      "Misreading vertex x-value as a root",
    ],
    miniExample: {
      prompt: "x^2 - 5x + 6 = 0",
      answer: "(x - 2)(x - 3) = 0, so x = 2 or 3.",
    },
    repairPattern: [
      "Identify which form would expose the requested information.",
      "Factor before using the formula if coefficients are friendly.",
      "Check roots by substitution or graphing.",
    ],
    decisionRules: [
      "If the question asks zeros, factored form is valuable.",
      "If it asks maximum/minimum, vertex form or -b/(2a) is valuable.",
      "If choices are expressions, expand or factor to match forms.",
    ],
    satMoves: [
      "Check for common factors first.",
      "Use Desmos to verify roots after algebra.",
      "Remember that (x - r) is a factor when r is a root.",
    ],
    microDrill: {
      prompt: "Which roots does (x - 4)(x + 1) = 0 have?",
      steps: [
        "Set each factor equal to zero.",
        "x - 4 = 0 gives 4.",
        "x + 1 = 0 gives -1.",
      ],
      answer: "x = 4 and x = -1.",
    },
    practiceCue: "Before solving, state which form of the quadratic would make the question easy.",
  },
  {
    key: "Exponents and Radicals",
    subject: "Math",
    domain: "Advanced Math",
    title: "Exponents and Radicals",
    summary: "Use exponent rules as structure shortcuts; avoid decimalizing too early.",
    keyPoints: [
      "Multiplying same bases adds exponents.",
      "Powers of powers multiply exponents.",
      "Radicals can be rewritten as fractional exponents.",
    ],
    commonTraps: [
      "Adding exponents when bases differ",
      "Multiplying bases when taking a power of a product incorrectly",
      "Forgetting that square roots are principal nonnegative values",
    ],
    miniExample: {
      prompt: "a^3 * a^5",
      answer: "a^8 because same bases multiply by adding exponents.",
    },
    repairPattern: [
      "Check whether bases match.",
      "Rewrite radicals as fractional exponents when useful.",
      "Simplify step by step without changing the base prematurely.",
    ],
    decisionRules: [
      "Same base multiplication: add exponents.",
      "Same base division: subtract exponents.",
      "Power raised to power: multiply exponents.",
    ],
    satMoves: [
      "Prime-factor awkward numbers.",
      "Use fractional exponents for root-power combinations.",
      "Keep exact radical form until the final comparison.",
    ],
    microDrill: {
      prompt: "Simplify (x^2)^5 / x^3.",
      steps: [
        "Power of power: x^10.",
        "Divide same base: subtract exponents.",
        "10 - 3 = 7.",
      ],
      answer: "x^7.",
    },
    practiceCue: "On misses, identify which exponent rule you applied incorrectly.",
  },
  {
    key: "Ratios, Rates, and Percent",
    subject: "Math",
    domain: "Problem Solving and Data Analysis",
    title: "Ratios, Rates, and Percent",
    summary: "Translate words into one proportion, rate, or percent-change equation before computing.",
    keyPoints: [
      "Percent means per 100.",
      "Percent change is change divided by original.",
      "Rates attach units and compare two different quantities.",
    ],
    commonTraps: [
      "Dividing by the new value instead of the original",
      "Dropping units in rate questions",
      "Adding percentages when the bases change",
    ],
    miniExample: {
      prompt: "A price rises from 80 to 100.",
      answer: "Increase is 20; 20/80 = 25%.",
    },
    repairPattern: [
      "Identify the base quantity.",
      "Write the formula with units.",
      "Compute only after the relationship is clear.",
    ],
    decisionRules: [
      "Original value is the denominator for percent change.",
      "If units differ, make a rate.",
      "For repeated percent changes, multiply factors instead of adding rates.",
    ],
    satMoves: [
      "Use new = old * (1 +/- r).",
      "Cross-multiply clean proportions.",
      "Use 100 as a friendly base when choices are percentages.",
    ],
    microDrill: {
      prompt: "A population decreases from 500 to 420. What is the percent decrease?",
      steps: [
        "Change is 80.",
        "Original is 500.",
        "80/500 = 0.16.",
      ],
      answer: "16%.",
    },
    practiceCue: "Write 'original denominator' on percent-change review items until it becomes automatic.",
  },
  {
    key: "Data Analysis and Probability",
    subject: "Math",
    domain: "Problem Solving and Data Analysis",
    title: "Data Analysis and Probability",
    summary: "Read the table or graph literally, then compute the requested relationship.",
    keyPoints: [
      "Probability is favorable outcomes divided by total outcomes.",
      "Mean is sensitive to extreme values; median is the middle.",
      "Graph questions depend on axis labels and units.",
    ],
    commonTraps: [
      "Using the wrong total in probability",
      "Reading bar height without checking axis scale",
      "Confusing median and mean",
    ],
    miniExample: {
      prompt: "There are 6 red and 4 blue marbles. Probability of blue?",
      answer: "4/10 = 2/5.",
    },
    repairPattern: [
      "Name numerator and denominator before calculating.",
      "Read labels and units before numbers.",
      "Use the statistic the question asks for, not the easiest one.",
    ],
    decisionRules: [
      "If the question says among, the denominator is that subgroup.",
      "If data are ordered, median is the middle value.",
      "If values have frequency, account for repeated values.",
    ],
    satMoves: [
      "Write P = favorable/total.",
      "For weighted means, multiply value by frequency.",
      "Check whether a graph scale skips numbers.",
    ],
    microDrill: {
      prompt: "A class has 12 juniors and 18 seniors. If one student is chosen, what is P(senior)?",
      steps: [
        "Favorable outcomes: 18 seniors.",
        "Total outcomes: 30 students.",
        "18/30 simplifies.",
      ],
      answer: "3/5.",
    },
    practiceCue: "For probability misses, write the denominator you used and the denominator you should have used.",
  },
  {
    key: "Geometry: Triangles, Circles, and Trig",
    subject: "Math",
    domain: "Geometry and Trigonometry",
    title: "Geometry: Triangles, Circles, and Trig",
    summary: "Draw, label, and choose the geometry fact before doing arithmetic.",
    keyPoints: [
      "Right triangles invite Pythagorean theorem or trig ratios.",
      "Circle equations reveal center and radius.",
      "Similar triangles preserve angle measures and side ratios.",
    ],
    commonTraps: [
      "Using diameter when the formula needs radius",
      "Applying trig ratios to the wrong angle",
      "Assuming a figure is drawn to scale",
    ],
    miniExample: {
      prompt: "A circle has equation (x - 3)^2 + (y + 2)^2 = 25.",
      answer: "Center is (3, -2), radius is 5.",
    },
    repairPattern: [
      "Sketch or annotate the figure.",
      "Choose the theorem or formula before substituting.",
      "Check whether the answer asks for radius, diameter, area, or circumference.",
    ],
    decisionRules: [
      "For right triangle side lengths, test Pythagorean theorem first.",
      "For angle-based side ratios, use sine, cosine, or tangent from the chosen angle.",
      "For circles in coordinate form, compare to (x - h)^2 + (y - k)^2 = r^2.",
    ],
    satMoves: [
      "Label opposite, adjacent, and hypotenuse before trig.",
      "Keep special triangles in exact form when possible.",
      "Convert diameter to radius before area or equation work.",
    ],
    microDrill: {
      prompt: "A right triangle has legs 6 and 8. What is the hypotenuse?",
      steps: [
        "Use a^2 + b^2 = c^2.",
        "36 + 64 = 100.",
        "c = 10.",
      ],
      answer: "10.",
    },
    practiceCue: "In each geometry review item, write the formula before plugging in numbers.",
  },
];
