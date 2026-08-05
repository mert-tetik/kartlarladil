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
        { text: "Let's level up how you look at things.", phase: "intro", activeTier: null },
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
    expect(parseProgressionPlan(JSON.stringify({ ...plan, narration: [...(plan?.narration ?? [])].reverse() }))?.narration.map((scene) => `${scene.phase}:${scene.activeTier}`)).toEqual([
      "intro:null", "term:A1", "explanation:A1", "term:B1", "explanation:B1", "term:C1", "explanation:C1", "outro:null",
    ]);
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
        { text: "Let's compare three levels.", phase: "intro", activeTier: null },
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

  it("accepts GPT-5.5's tier-keyed term object", () => {
    const plan = parseProgressionPlan(JSON.stringify({
      caption: "Three ways to begin. #languagelearning #vocabulary",
      terms: { A1: "start", B1: "begin", C1: "commence" },
      narration: [
        { text: "Let us compare three levels.", phase: "intro", activeTier: null },
        { text: "start", phase: "term", activeTier: "A1" },
        { text: "A basic word for beginning.", phase: "explanation", activeTier: "A1" },
        { text: "begin", phase: "term", activeTier: "B1" },
        { text: "A natural alternative for starting.", phase: "explanation", activeTier: "B1" },
        { text: "commence", phase: "term", activeTier: "C1" },
        { text: "A formal word for beginning.", phase: "explanation", activeTier: "C1" },
        { text: "Use the word that fits the situation.", phase: "outro", activeTier: null },
      ],
    }));

    expect(plan?.terms).toEqual([{ tier: "A1", term: "start" }, { tier: "B1", term: "begin" }, { tier: "C1", term: "commence" }]);
  });

  it("normalizes reordered scene aliases from Terra", () => {
    const plan = parseProgressionPlan(JSON.stringify({
      caption: "Build precise vocabulary. #languagelearning #vocabulary",
      terms: [
        { level: "a1", word: "look" },
        { level: "b1", word: "observe" },
        { level: "c1", word: "scrutinize" },
      ],
      scenes: [
        { text: "Let us compare three levels.", type: "introduction" },
        { text: "Use the most precise word when it fits.", type: "summary" },
        { text: "To look is to direct your eyes at something.", type: "definition", active_tier: "A1" },
        { text: "observe", type: "word", tier: "B1" },
        { text: "To scrutinize is to examine very carefully.", type: "explain", tier: "C1" },
        { text: "look", type: "word", tier: "A1" },
        { text: "To observe is to watch carefully.", type: "meaning", tier: "B1" },
        { text: "scrutinize", type: "word", tier: "C1" },
      ],
    }));

    expect(plan?.narration.map((scene) => `${scene.phase}:${scene.activeTier}`)).toEqual([
      "intro:null", "term:A1", "explanation:A1", "term:B1", "explanation:B1", "term:C1", "explanation:C1", "outro:null",
    ]);
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
