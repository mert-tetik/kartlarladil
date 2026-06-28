import { describe, expect, it } from "vitest";
import { parseAiValidationResponse } from "@/features/quiz/ai-validate-answer-parser";

describe("parseAiValidationResponse", () => {
  it("accepts JSON with accepted: true", () => {
    expect(parseAiValidationResponse('{"accepted": true}')).toBe(true);
  });

  it("rejects JSON with accepted: false", () => {
    expect(parseAiValidationResponse('{"accepted": false}')).toBe(false);
  });

  it("rejects invalid JSON", () => {
    expect(parseAiValidationResponse("yes")).toBe(false);
  });

  it("rejects JSON without accepted field", () => {
    expect(parseAiValidationResponse('{"reason": "close synonym"}')).toBe(false);
  });

  it("rejects empty response", () => {
    expect(parseAiValidationResponse("")).toBe(false);
  });
});
