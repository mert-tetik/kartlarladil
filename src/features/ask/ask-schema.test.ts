import { askChatRequestSchema } from "@/features/ask/ask-schema";

const validRequest = {
  language: "en",
  locale: "tr",
  messages: [{ role: "user", content: "Explain the word hello to me." }],
};

describe("askChatRequestSchema", () => {
  it("accepts a valid ask request", () => {
    expect(askChatRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects unsupported languages", () => {
    expect(askChatRequestSchema.safeParse({ ...validRequest, language: "xx" }).success).toBe(false);
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
