import { describe, expect, it } from "vitest";
import {
  isSelfExampleSentencesContent,
  normalizeSelfExampleSentence,
} from "@/features/twitter-automation/self-example-sentences";

const examples = {
  sentences: [
    { sentence: "I missed the last train home.", translation: "Eve giden son treni ka\u00e7\u0131rd\u0131m." },
    { sentence: "She keeps a notebook in her bag.", translation: "\u00c7antas\u0131nda her zaman bir defter ta\u015f\u0131r." },
    { sentence: "We finally found a quiet place to talk.", translation: "Sonunda konu\u015fmak i\u00e7in sakin bir yer bulduk." },
  ],
};

describe("self example sentences", () => {
  it("normalizes generated sentences before duplicate checks", () => {
    expect(normalizeSelfExampleSentence("  I MISSED  THE LAST TRAIN HOME. ")).toBe("i missed the last train home.");
  });

  it("requires exactly three complete sentence and translation pairs", () => {
    expect(isSelfExampleSentencesContent(examples)).toBe(true);
    expect(isSelfExampleSentencesContent({ ...examples, sentences: examples.sentences.slice(0, 2) })).toBe(false);
    expect(isSelfExampleSentencesContent({
      sentences: [{ sentence: "A complete sentence.", translation: "Tam bir c\u00fcmle." }, { sentence: "", translation: "Eksik." }, examples.sentences[2]],
    })).toBe(false);
  });
});
