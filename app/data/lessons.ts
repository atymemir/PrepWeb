export type Lesson = {
  key: string; // subskill name, exact match
  title: string;
  summary: string;
  keyPoints: string[];
  commonTraps: string[];
  miniExample: { prompt: string; answer: string };
};

export const LESSONS: Lesson[] = [
  {
    key: "Information and Ideas",
    title: "Information and Ideas",
    summary:
      "These questions test whether you can identify what the text explicitly says and what it logically implies.",
    keyPoints: [
      "Underline the question’s task: complete the text, main idea, inference, evidence, etc.",
      "Eliminate choices that add new facts not supported by the text.",
      "For inference: pick the choice that must be true, not what could be true.",
    ],
    commonTraps: [
      "Choices that sound smart but go beyond the text",
      "Too extreme words: always/never/completely",
      "Wrong cause-effect (confusing correlation with causation)",
    ],
    miniExample: {
      prompt: "If the text says native seed-spreading birds are extinct but introduced birds spread seeds now, what follows?",
      answer: "Plants may now rely on non-native birds to maintain populations.",
    },
  },
  {
    key: "Craft and Structure",
    title: "Craft and Structure",
    summary:
      "These questions test vocabulary-in-context, tone, and how the author builds meaning.",
    keyPoints: [
      "Vocabulary: use the sentence context and the concrete action described.",
      "Tone: look for attitude words (praise, doubt, criticism) and formality.",
      "Structure: track why each sentence is there (example, contrast, conclusion).",
    ],
    commonTraps: [
      "Choosing a dictionary meaning that doesn’t fit the context",
      "Ignoring nearby clues (verbs/objects)",
      "Overthinking: the simplest contextual meaning is often correct",
    ],
    miniExample: {
      prompt: "“I drop my bag…” in a scene entering a room most nearly means…",
      answer: "Put down.",
    },
  },
];

