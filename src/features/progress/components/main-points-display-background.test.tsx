import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MainPointsDisplayBackground } from "./main-points-display-background";

describe("MainPointsDisplayBackground", () => {
  it("renders the three crop layers without an idle pulse", () => {
    const { container } = render(
      <div className="relative h-10 w-40">
        <MainPointsDisplayBackground />
      </div>,
    );

    const background = container.querySelector("[data-main-points-display-background]");
    expect(background).toBeInTheDocument();
    expect(background?.querySelectorAll("img")).toHaveLength(3);
    expect(background).not.toHaveClass("animate-score-bobble");
    expect(background).not.toHaveClass("animate-score-bobble-alt");
  });

  it("applies one shared pulse class to the whole composition", () => {
    const { container } = render(
      <div className="relative h-10 w-40">
        <MainPointsDisplayBackground pulse={2} />
      </div>,
    );

    const background = container.querySelector("[data-main-points-display-background]");
    expect(background).toHaveClass("animate-score-bobble-alt");
    expect(background?.querySelectorAll(".animate-score-bobble, .animate-score-bobble-alt")).toHaveLength(0);
  });
});
