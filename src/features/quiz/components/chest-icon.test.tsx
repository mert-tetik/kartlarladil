import { render } from "@testing-library/react";
import { ChestIcon } from "./chest-icon";

describe("ChestIcon", () => {
  it("renders each chest tier as one composed image", () => {
    const { container } = render(<ChestIcon tier="wood" hideLid />);

    expect(container.querySelectorAll("[data-chest-artwork]")).toHaveLength(1);
    expect(container.querySelector("[data-chest-artwork]")?.getAttribute("src")).toContain(
      "wooden_chest.webp",
    );
  });

  it("supports the small preview artwork used by count selection", () => {
    const { container } = render(
      <ChestIcon
        tier="wood"
        artworkSrc="/chests/count-preview/wood.webp"
        unoptimized
        priority
        sizes="36px"
      />,
    );
    const image = container.querySelector("[data-chest-artwork]");

    expect(image?.getAttribute("src")).toBe("/chests/count-preview/wood.webp");
  });
});
