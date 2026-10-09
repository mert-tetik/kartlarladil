import { render, screen } from "@testing-library/react";
import { QuizResultMessageTest } from "./quiz-result-message-test";

vi.mock("@/features/quiz/components/quiz-result-message-view", () => ({
  QuizResultMessageView: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" data-testid="quiz-result-message-test-view" onClick={onComplete}>
      result message
    </button>
  ),
}));

describe("QuizResultMessageTest", () => {
  it("renders the production celebration harness and loops after completion", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();

    render(<QuizResultMessageTest />);

    expect(screen.getByTestId("quiz-result-message-test-view")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-result-message-test-view").parentElement).toHaveAttribute(
      "data-quiz-result-message-test-round",
      "0",
    );

    await user.click(screen.getByTestId("quiz-result-message-test-view"));

    expect(screen.getByTestId("quiz-result-message-test-view").parentElement).toHaveAttribute(
      "data-quiz-result-message-test-round",
      "1",
    );
  });
});
