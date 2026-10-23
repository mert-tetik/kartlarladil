import { afterEach, describe, expect, it, vi } from "vitest";
import { fitCardExampleText } from "@/features/cards/card-example-fitting";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function createExample(text: string) {
  const front = document.createElement("article");
  front.className = "fd-card-design__front";
  const example = document.createElement("p");
  example.className = "fd-card-design__example";
  example.textContent = text;
  front.append(example);
  document.body.append(front);
  return { front, example };
}

function lineRects(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    top: index * 24,
    width: 120,
    height: 22,
  }) as DOMRect);
}

describe("fitCardExampleText", () => {
  it("scales a four-line example down until it uses at most three lines", () => {
    const { front, example } = createExample("A long example sentence that wraps onto four lines.");
    vi.spyOn(document, "createRange").mockImplementation(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => {
        const scale = Number(example.style.getPropertyValue("--fd-card-example-font-scale") || 1);
        return lineRects(scale < 0.75 ? 3 : 4);
      },
    }) as unknown as Range);

    expect(fitCardExampleText(example)).toBe(3);
    expect(Number(example.style.getPropertyValue("--fd-card-example-font-scale"))).toBeLessThan(0.75);
    expect(front).toHaveAttribute("data-example-line-count", "3");
  });

  it("keeps shrinking longer examples below the regular minimum until they fit", () => {
    const { example } = createExample("A much longer example sentence that needs a substantially smaller font size.");
    vi.spyOn(document, "createRange").mockImplementation(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => {
        const scale = Number(example.style.getPropertyValue("--fd-card-example-font-scale") || 1);
        return lineRects(scale < 0.25 ? 3 : 5);
      },
    }) as unknown as Range);

    expect(fitCardExampleText(example)).toBe(3);
    expect(Number(example.style.getPropertyValue("--fd-card-example-font-scale"))).toBeLessThan(0.25);
  });

  it("preserves line breaks unless they would force a fourth line", () => {
    const { example } = createExample("One\nTwo\nThree\nFour");
    vi.spyOn(document, "createRange").mockImplementation(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => lineRects(example.hasAttribute("data-example-breaks-collapsed") ? 2 : 4),
    }) as unknown as Range);

    expect(fitCardExampleText(example)).toBe(2);
    expect(example).toHaveAttribute("data-example-breaks-collapsed");
    expect(example.style.getPropertyValue("--fd-card-example-font-scale")).toBe("1");
  });
});
