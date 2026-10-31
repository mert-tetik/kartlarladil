import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScorePulse } from "./score-pulse";

describe("ScorePulse", () => {
  it("alternates its animation class for consecutive arrivals", () => {
    const { container, rerender } = render(<ScorePulse pulse={1}>25</ScorePulse>);
    const group = container.querySelector("[data-score-pulse-group]");

    expect(group).toHaveClass("animate-score-bobble");
    rerender(<ScorePulse pulse={2}>50</ScorePulse>);
    expect(group).toHaveClass("animate-score-bobble-alt");
    rerender(<ScorePulse pulse={3}>75</ScorePulse>);
    expect(group).toHaveClass("animate-score-bobble");
  });
});
