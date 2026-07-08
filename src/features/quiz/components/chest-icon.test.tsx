import { render } from "@testing-library/react";
import { ChestIcon } from "./chest-icon";

describe("ChestIcon", () => {
  it("hides the lid when requested", () => {
    const { container } = render(<ChestIcon tier="wood" hideLid />);

    expect(container.querySelector("[data-chest-icon-lid]")).not.toBeInTheDocument();
  });

  it("shows the lid by default", () => {
    const { container } = render(<ChestIcon tier="wood" />);

    expect(container.querySelector("[data-chest-icon-lid]")).toBeInTheDocument();
  });
});
