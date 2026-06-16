import {
  aiPracticeChatRequestSchema,
  aiPracticeTranslateRequestSchema,
} from "@/features/ai-practice/ai-practice-schema";

const validRequest = {
  language: "en",
  characterId: "gentle-companion",
  messages: [{ role: "user", content: "Hello, how are you?" }],
};

describe("aiPracticeChatRequestSchema", () => {
  it("accepts a valid chat request", () => {
    expect(aiPracticeChatRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("defaults the tier to A1 when omitted", () => {
    const result = aiPracticeChatRequestSchema.safeParse(validRequest);

    expect(result.success).toBe(true);
    expect(result.data?.tier).toBe("A1");
  });

  it("accepts a valid tier", () => {
    expect(aiPracticeChatRequestSchema.safeParse({ ...validRequest, tier: "B2" }).success).toBe(true);
  });

  it("rejects invalid tiers", () => {
    expect(aiPracticeChatRequestSchema.safeParse({ ...validRequest, tier: "C2" }).success).toBe(false);
  });

  it("rejects unsupported languages", () => {
    expect(aiPracticeChatRequestSchema.safeParse({ ...validRequest, language: "xx" }).success).toBe(false);
  });

  it("rejects assistant as the latest message", () => {
    expect(
      aiPracticeChatRequestSchema.safeParse({
        ...validRequest,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects overly long messages", () => {
    expect(
      aiPracticeChatRequestSchema.safeParse({
        ...validRequest,
        messages: [{ role: "user", content: "a".repeat(901) }],
      }).success,
    ).toBe(false);
  });
});

describe("aiPracticeTranslateRequestSchema", () => {
  const validTranslateRequest = {
    language: "en",
    targetLocale: "tr",
    text: "hello there",
  };

  it("accepts a valid translate request", () => {
    expect(aiPracticeTranslateRequestSchema.safeParse(validTranslateRequest).success).toBe(true);
  });

  it("rejects empty translation text", () => {
    expect(aiPracticeTranslateRequestSchema.safeParse({ ...validTranslateRequest, text: "" }).success).toBe(false);
  });

  it("rejects unsupported target locales", () => {
    expect(aiPracticeTranslateRequestSchema.safeParse({ ...validTranslateRequest, targetLocale: "xx" }).success).toBe(false);
  });
});
