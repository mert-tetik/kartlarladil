import { describe, expect, it } from "vitest";
import { parseConfusedWordsVideoPlan } from "./confused-words-video-plan";

const phase = (firstTerm: string, secondTerm: string) => ({
  firstTerm,
  secondTerm,
  connector: "ve",
  question: "Farkları ne?",
  firstMeaningTail: "daha hafif bir kızgınlığı anlatırken",
  secondMeaningTail: "çok daha yoğun öfkeyi anlatır",
});

describe("Confused Words video plan", () => {
  it("accepts the exact three-phase plan without an unused caption", () => {
    const value = JSON.stringify({ phases: [phase("angry", "furious"), phase("look", "watch"), phase("say", "tell")] });

    expect(parseConfusedWordsVideoPlan(value)?.phases[0]).toMatchObject({ firstTerm: "angry", secondTerm: "furious" });
  });

  it("accepts single-character target-language words", () => {
    const value = JSON.stringify({ phases: [phase("看", "见"), phase("听", "闻"), phase("问", "说")] });

    expect(parseConfusedWordsVideoPlan(value)?.phases).toHaveLength(3);
  });

  it("still rejects duplicate terms across the three phases", () => {
    const value = JSON.stringify({ phases: [phase("angry", "furious"), phase("look", "watch"), phase("angry", "tell")] });

    expect(parseConfusedWordsVideoPlan(value)).toBeNull();
  });
});
