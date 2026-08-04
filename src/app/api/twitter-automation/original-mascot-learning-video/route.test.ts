import { describe, expect, it } from "vitest";
import { parseProgressionPlan, parseQuizPlan, parseSentencePlan } from "@/features/twitter-automation/original-mascot-learning-video-plan";

describe("Original mascot learning video plans", () => {
  it("accepts a complete A1, B1, C1 progression in term-then-explanation order", () => {
    const plan = parseProgressionPlan(JSON.stringify({
      caption: "Learn it step by step. #languagelearning #vocabulary",
      terms: [
        { tier: "A1", term: "look" },
        { tier: "B1", term: "watch" },
        { tier: "C1", term: "observe" },
      ],
      narration: [
        { text: "look", phase: "term", activeTier: "A1" },
        { text: "Look means to direct your eyes toward something.", phase: "explanation", activeTier: "A1" },
        { text: "watch", phase: "term", activeTier: "B1" },
        { text: "Watch means to look carefully for a while.", phase: "explanation", activeTier: "B1" },
        { text: "observe", phase: "term", activeTier: "C1" },
        { text: "Observe means to notice details carefully.", phase: "explanation", activeTier: "C1" },
        { text: "Choose the word that matches how carefully you look.", phase: "outro", activeTier: null },
      ],
    }));

    expect(plan?.terms.map((term) => term.tier)).toEqual(["A1", "B1", "C1"]);
    expect(parseProgressionPlan(JSON.stringify({ ...plan, narration: [...(plan?.narration ?? [])].reverse() }))).toBeNull();
  });

  it("accepts Terra's word field for progression terms", () => {
    const plan = parseProgressionPlan(JSON.stringify({
      caption: "Build precise vocabulary. #languagelearning #vocabulary",
      terms: [
        { tier: "A1", word: "look" },
        { tier: "B1", word: "observe" },
        { tier: "C1", word: "scrutinize" },
      ],
      narration: [
        { text: "look", phase: "term", activeTier: "A1" },
        { text: "Basic looking.", phase: "explanation", activeTier: "A1" },
        { text: "observe", phase: "term", activeTier: "B1" },
        { text: "Careful looking.", phase: "explanation", activeTier: "B1" },
        { text: "scrutinize", phase: "term", activeTier: "C1" },
        { text: "Very detailed looking.", phase: "explanation", activeTier: "C1" },
        { text: "Use the precise option.", phase: "outro", activeTier: null },
      ],
    }));

    expect(plan?.terms.map((term) => term.term)).toEqual(["look", "observe", "scrutinize"]);
  });

  it("rejects incomplete quiz and sentence scripts", () => {
    expect(parseQuizPlan('{"caption":"x","question":"x"}')).toBeNull();
    expect(parseSentencePlan(JSON.stringify({
      caption: "Check this. #grammar #languagelearning",
      sentence: "She go to work every day.",
      isCorrect: false,
      correction: "",
      question: "Is this sentence correct?",
      reveal: "It is incorrect.",
      explanation: "Third person singular needs goes.",
    }))).toBeNull();
  });

  it("accepts a correct sentence without correction and extracts JSON fenced output", () => {
    const plan = parseSentencePlan("```json\n" + JSON.stringify({
      caption: "Can you spot it? #grammar #languagelearning",
      sentence: "I have lived here for three years.",
      isCorrect: true,
      correction: "",
      question: "Is this sentence correct?",
      reveal: "Yes, it is correct.",
      explanation: "Present perfect works with an unfinished period of time.",
    }) + "\n```");

    expect(plan).toMatchObject({ isCorrect: true, correction: "" });
  });
});
