import { shouldLockBodyScroll } from "@/components/body-scroll-lock";

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
    expect(shouldLockBodyScroll("/ai-practice", false)).toBe(true);
    expect(shouldLockBodyScroll("/ask/en", false)).toBe(true);
  });
});
