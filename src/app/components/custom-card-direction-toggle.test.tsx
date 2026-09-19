import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CustomCardDirectionToggle } from "@/app/components/custom-card-direction-toggle";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("CustomCardDirectionToggle", () => {
  it("starts with native-to-learning selected and switches direction", () => {
    const onChange = vi.fn();

    render(
      <LocaleProvider initialLocale="en">
        <CustomCardDirectionToggle value="native-to-learning" learningLanguage="en" onChange={onChange} />
      </LocaleProvider>,
    );

    const nativeButton = screen.getByRole("button", { name: "Native language → learning language" });
    const learningButton = screen.getByRole("button", { name: "Learning language → native language" });

    expect(nativeButton).toHaveAttribute("aria-pressed", "true");
    expect(learningButton).toHaveAttribute("aria-pressed", "false");
    expect(nativeButton).toHaveTextContent("");
    expect(learningButton).toHaveTextContent("");
    expect(nativeButton.querySelector("[data-create-card-direction-icons='native-to-learning']")).not.toBeNull();
    expect(learningButton.querySelector("[data-create-card-direction-icons='learning-to-native']")).not.toBeNull();

    fireEvent.click(learningButton);
    expect(onChange).toHaveBeenCalledWith("learning-to-native");
  });
});
