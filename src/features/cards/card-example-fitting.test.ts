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
  const fox = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  fox.classList.add("fd-card-design__front-fox");
  front.append(fox, example);
  document.body.append(front);
  return { front, fox, example };
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
    const { front, fox, example } = createExample("A long example sentence that wraps onto four lines.");
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
    expect(fox).toHaveAttribute("hidden");
    expect(fox.style.display).toBe("none");
  });

  it("restores the fox mark when the example fits in fewer than three lines", () => {
    const { fox, example } = createExample("A short example.");
    vi.spyOn(document, "createRange").mockImplementation(() => ({
      selectNodeContents: vi.fn(),
      getClientRects: () => lineRects(2),
    }) as unknown as Range);

    expect(fitCardExampleText(example)).toBe(2);
    expect(fox).not.toHaveAttribute("hidden");
    expect(fox.style.display).toBe("");
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
