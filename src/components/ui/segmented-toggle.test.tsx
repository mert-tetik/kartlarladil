import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";

describe("SegmentedToggle", () => {
  it("marks the active option and reports the selected option", () => {
    const onChange = vi.fn();

    render(
      <SegmentedToggle
        value="points"
        onChange={onChange}
        className="w-full"
        selectedClassName="bg-white !text-slate-950 hover:bg-white"
        labelClassName="font-super-water"
        options={[
          { value: "points", label: "Points" },
          { value: "streaks", label: "Streaks" },
        ]}
      />,
    );

    const pointsButton = screen.getByRole("button", { name: "Points" });
    const streaksButton = screen.getByRole("button", { name: "Streaks" });

    expect(screen.getByRole("group")).toHaveClass("w-full");
    expect(pointsButton).toHaveAttribute("aria-pressed", "true");
    expect(streaksButton).toHaveAttribute("aria-pressed", "false");
    expect(pointsButton).toHaveClass("bg-white");
    expect(pointsButton).toHaveClass("font-super-water");

    fireEvent.click(streaksButton);

    expect(onChange).toHaveBeenCalledWith("streaks");
  });
});
