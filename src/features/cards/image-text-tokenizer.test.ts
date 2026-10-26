import { describe, expect, it } from "vitest";
import { segmentTextWithWordIndices } from "@/features/cards/image-text-tokenizer";

describe("segmentTextWithWordIndices", () => {
  it("preserves text and numbers word segments without counting punctuation", () => {
    const text = "Hello, world!";
    const segments = segmentTextWithWordIndices(text, "en");

    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments.filter((segment) => segment.isWordLike).map((segment) => segment.wordIndex)).toEqual([0, 1]);
    expect(segments.filter((segment) => !segment.isWordLike).every((segment) => segment.wordIndex === null)).toBe(true);
  });

  it("returns no segments for empty input", () => {
    expect(segmentTextWithWordIndices("", "en")).toEqual([]);
  });
});
