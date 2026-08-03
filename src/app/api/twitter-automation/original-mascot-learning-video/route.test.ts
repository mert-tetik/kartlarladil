import { describe, expect, it } from "vitest";
import { parseProgressionPlan, parseQuizPlan, parseSentencePlan } from "@/app/api/twitter-automation/original-mascot-learning-video/route";

describe("Original mascot learning video plans", () => {
  it("accepts a complete A1, B1, C1 progression and requires every active tier", () => {
    const plan = parseProgressionPlan(JSON.stringify({
      caption: "Learn it step by step. #languagelearning #vocabulary",
      terms: [
        { tier: "A1", term: "look" },
        { tier: "B1", term: "watch" },
        { tier: "C1", term: "observe" },
      ],
      narration: [
        { text: "Start with look.", voice: "learning", activeTier: "A1" },
        { text: "Then watch more carefully.", voice: "learning", activeTier: "B1" },
        { text: "Observe is the most precise.", voice: "learning", activeTier: "C1" },
        { text: "Use the right word for the detail you need.", voice: "native", activeTier: null },
      ],
    }));

    expect(plan?.terms.map((term) => term.tier)).toEqual(["A1", "B1", "C1"]);
    expect(parseProgressionPlan(JSON.stringify({ ...plan, narration: plan?.narration.filter((scene) => scene.activeTier !== "C1") }))).toBeNull();
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
