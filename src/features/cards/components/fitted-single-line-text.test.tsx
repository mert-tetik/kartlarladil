import { render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { FittedSingleLineText } from "@/features/cards/components/fitted-single-line-text";

afterEach(() => vi.restoreAllMocks());

describe("FittedSingleLineText", () => {
  it("scales long text down to fit its available width", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-single-line-fit-container") ? 120 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-single-line-fit-content") ? 300 : 0;
    });

    render(<FittedSingleLineText>A very long vocabulary word</FittedSingleLineText>);

    expect(screen.getByText("A very long vocabulary word")).toHaveStyle({ transform: "scale(0.384)" });
  });

  it("anchors centered text to its midpoint while scaling", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-single-line-fit-container") ? 120 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-single-line-fit-content") ? 300 : 0;
    });

    render(<FittedSingleLineText centered>Gouverneur</FittedSingleLineText>);

    const container = screen.getByText("Gouverneur").parentElement;
    expect(container).toHaveAttribute("data-single-line-fit-centered");
    expect(screen.getByText("Gouverneur")).toHaveStyle({ transform: "translateX(-50%) scale(0.384)" });
  });
});
