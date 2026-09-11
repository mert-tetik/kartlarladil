import { render, screen } from "@testing-library/react";
import { QuizResultMessageTest } from "./quiz-result-message-test";

vi.mock("@/features/quiz/components/chest-celebration-view", () => ({
  ChestCelebrationView: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" data-testid="chest-celebration-test-view" onClick={onComplete}>
      celebration
    </button>
  ),
}));

describe("QuizResultMessageTest", () => {
  it("renders the production celebration harness and loops after completion", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();

    render(<QuizResultMessageTest />);

    expect(screen.getByTestId("chest-celebration-test-view")).toBeInTheDocument();
    expect(screen.getByTestId("chest-celebration-test-view").parentElement).toHaveAttribute(
      "data-quiz-result-message-test-round",
      "0",
    );

    await user.click(screen.getByTestId("chest-celebration-test-view"));

    expect(screen.getByTestId("chest-celebration-test-view").parentElement).toHaveAttribute(
      "data-quiz-result-message-test-round",
      "1",
    );
  });
});
