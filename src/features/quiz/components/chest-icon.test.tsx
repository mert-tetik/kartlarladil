import { render } from "@testing-library/react";
import { ChestIcon } from "./chest-icon";

describe("ChestIcon", () => {
  it("renders each chest tier as one composed image", () => {
    const { container } = render(<ChestIcon tier="wood" hideLid />);

    expect(container.querySelectorAll("[data-chest-artwork]")).toHaveLength(1);
    expect(container.querySelector("[data-chest-artwork]")?.getAttribute("src")).toContain(
      "wooden_chest.png",
    );
  });
});
