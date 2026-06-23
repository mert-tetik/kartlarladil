import {
  shouldLockBodyScroll,
  shouldPreventBoundaryScroll,
} from "@/components/body-scroll-lock";

describe("shouldLockBodyScroll", () => {
  it("keeps desktop my-cards pages scrollable", () => {
    expect(shouldLockBodyScroll("/my-cards", false)).toBe(false);
    expect(shouldLockBodyScroll("/my-cards/details", false)).toBe(false);
  });

  it("keeps mobile my-cards pages locked", () => {
    expect(shouldLockBodyScroll("/my-cards", true)).toBe(true);
    expect(shouldLockBodyScroll("/my-cards/details", true)).toBe(true);
  });

  it("locks learn only on mobile and keeps ai-practice/ask locked", () => {
    expect(shouldLockBodyScroll("/learn", false)).toBe(false);
    expect(shouldLockBodyScroll("/learn", true)).toBe(true);
    expect(shouldLockBodyScroll("/card-draw", false)).toBe(false);
    expect(shouldLockBodyScroll("/card-draw", true)).toBe(true);
    expect(shouldLockBodyScroll("/ai-practice", false)).toBe(true);
    expect(shouldLockBodyScroll("/ask/en", false)).toBe(true);
  });
});

describe("shouldPreventBoundaryScroll", () => {
  it("blocks pulling past the top and pushing past the bottom", () => {
    expect(
      shouldPreventBoundaryScroll(
        { scrollTop: 0, clientHeight: 400, scrollHeight: 900 },
        12,
      ),
    ).toBe(true);
    expect(
      shouldPreventBoundaryScroll(
        { scrollTop: 500, clientHeight: 400, scrollHeight: 900 },
        -12,
      ),
    ).toBe(true);
  });

  it("allows movement toward available scroll content", () => {
    expect(
      shouldPreventBoundaryScroll(
        { scrollTop: 0, clientHeight: 400, scrollHeight: 900 },
        -12,
      ),
    ).toBe(false);
    expect(
      shouldPreventBoundaryScroll(
        { scrollTop: 250, clientHeight: 400, scrollHeight: 900 },
        12,
      ),
    ).toBe(false);
  });
});
