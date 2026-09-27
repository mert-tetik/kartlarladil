import { render, screen, waitFor } from "@testing-library/react";
import { QuizMobileActionPortal } from "@/features/quiz/components/quiz-mobile-action-portal";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

describe("QuizMobileActionPortal", () => {
  afterEach(() => {
    document.body.removeAttribute("data-learn-page");
    document.body.removeAttribute("data-normal-test");
  });

  it("escapes transformed Learn containers on mobile", async () => {
    setViewportWidth(412);
    render(
      <div data-learn-page>
        <div style={{ transform: "translate3d(0, 0, 0)" }}>
          <QuizMobileActionPortal>
            <div data-testid="mobile-actions" />
          </QuizMobileActionPortal>
        </div>
      </div>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mobile-actions").parentElement).toBe(document.body);
    });
  });

  it("keeps isolated normal-test actions inside their overlay", async () => {
    setViewportWidth(412);
    render(
      <div data-learn-page>
        <div data-normal-test>
          <QuizMobileActionPortal>
            <div data-testid="normal-test-actions" />
          </QuizMobileActionPortal>
        </div>
      </div>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("normal-test-actions").parentElement).not.toBe(document.body);
    });
  });
});
