import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuizWordButtonTest } from "./quiz-word-button-test";

describe("QuizWordButtonTest", () => {
  it("lets the type dropdown preview the button interaction behavior", () => {
    render(<QuizWordButtonTest />);

    const button = screen.getByRole("button", { name: "kelime" });
    const stateSelect = screen.getByRole("combobox", { name: "Buton durumu" });

    expect(button).toHaveAttribute("data-quiz-word-type", "select");

    fireEvent.click(button);
    expect(button).toHaveAttribute("data-quiz-word-state", "selected");
    expect(button).toHaveClass("animate-quiz-word-button-select");

    fireEvent.change(stateSelect, { target: { value: "correct" } });
    const correctButton = screen.getByRole("button", { name: "kelime" });
    expect(correctButton).toHaveAttribute("data-quiz-word-type", "correct");
    expect(correctButton).toHaveAttribute("data-quiz-word-state", "idle");
    fireEvent.click(correctButton);
    expect(correctButton).toHaveAttribute("data-quiz-word-state", "correct");

    fireEvent.change(stateSelect, { target: { value: "select" } });
    const selectButton = screen.getByRole("button", { name: "kelime" });
    expect(selectButton).toHaveAttribute("data-quiz-word-state", "idle");
    expect(selectButton).not.toHaveClass("animate-quiz-word-button-select");

    fireEvent.change(stateSelect, { target: { value: "inactive" } });
    const inactiveButton = screen.getByRole("button", { name: "kelime" });
    expect(inactiveButton).toHaveAttribute("data-quiz-word-type", "inactive");
    expect(inactiveButton).toHaveAttribute("data-quiz-word-state", "idle");
    expect(inactiveButton).not.toBeDisabled();
    fireEvent.click(inactiveButton);
    expect(inactiveButton).toHaveAttribute("data-quiz-word-state", "muted");
    expect(inactiveButton).toBeDisabled();
  });
});
