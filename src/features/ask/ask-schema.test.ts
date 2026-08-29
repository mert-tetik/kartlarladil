import { askChatRequestSchema } from "@/features/ask/ask-schema";

const validRequest = {
  locale: "tr",
  messages: [{ role: "user", content: "Explain the word hello to me." }],
};

describe("askChatRequestSchema", () => {
  it("accepts a valid ask request without a selected language", () => {
    expect(askChatRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("accepts an optional inferred language state", () => {
    expect(
      askChatRequestSchema.safeParse({
        ...validRequest,
        languageState: {
          nativeLanguageCode: "tr",
          learningLanguageCode: "en",
        },
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported context languages", () => {
    expect(askChatRequestSchema.safeParse({ ...validRequest, contextLanguage: "xx" }).success).toBe(false);
  });

  it("rejects unsupported inferred languages", () => {
    expect(
      askChatRequestSchema.safeParse({
        ...validRequest,
        languageState: { nativeLanguageCode: "xx", learningLanguageCode: "unknown" },
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported locales", () => {
    expect(askChatRequestSchema.safeParse({ ...validRequest, locale: "xx" }).success).toBe(false);
  });

  it("rejects empty messages", () => {
    expect(askChatRequestSchema.safeParse({ ...validRequest, messages: [] }).success).toBe(false);
  });

  it("rejects overly long messages", () => {
    expect(
      askChatRequestSchema.safeParse({
        ...validRequest,
        messages: [{ role: "user", content: "a".repeat(901) }],
      }).success,
    ).toBe(false);
  });
});
