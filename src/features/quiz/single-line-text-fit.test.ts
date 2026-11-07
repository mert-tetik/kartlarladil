import { describe, expect, it } from "vitest";
import { getSingleLineFitFontSize } from "@/features/quiz/single-line-text-fit";

describe("getSingleLineFitFontSize", () => {
  it("keeps the original font size when the text already fits", () => {
    expect(getSingleLineFitFontSize(48, 180, 200)).toBe(48);
  });

  it("shrinks overflowing text with a small safety margin", () => {
    expect(getSingleLineFitFontSize(48, 400, 200)).toBeCloseTo(23.52);
  });

  it("keeps the original size when layout width is not measurable yet", () => {
    expect(getSingleLineFitFontSize(48, 400, 0)).toBe(48);
  });
});
