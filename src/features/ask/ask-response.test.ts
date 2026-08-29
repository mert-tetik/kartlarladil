import { parseAskResponse } from "@/features/ask/ask-response";

describe("parseAskResponse", () => {
  it("parses the structured response and its inferred languages", () => {
    expect(
      parseAskResponse(JSON.stringify({
        reply: "İngilizcede hello, merhaba demektir.",
        nativeLanguageCode: "tr",
        learningLanguageCode: "en",
        isLearningRequest: true,
      })),
    ).toEqual({
      reply: "İngilizcede hello, merhaba demektir.",
      nativeLanguageCode: "tr",
      learningLanguageCode: "en",
      isLearningRequest: true,
    });
  });

  it("allows a natural native-language message with no learning target", () => {
    expect(
      parseAskResponse(JSON.stringify({
        reply: "Merhaba! Ben de iyiyim.",
        nativeLanguageCode: "tr",
        learningLanguageCode: "unknown",
        isLearningRequest: false,
      }))?.learningLanguageCode,
    ).toBe("unknown");
  });

  it("rejects malformed model output", () => {
    expect(parseAskResponse("not json")).toBeNull();
    expect(parseAskResponse(JSON.stringify({ reply: "only a reply" }))).toBeNull();
  });
});
