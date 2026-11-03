import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizContinuationMotivationView } from "./quiz-continuation-motivation-view";

const routerPushMock = vi.hoisted(() => vi.fn());
const openLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

vi.mock("@/features/leaderboard/components/leaderboard-overlay-provider", () => ({
  useLeaderboardOverlay: () => ({ openLeaderboard: openLeaderboardMock }),
}));

vi.mock("@/features/leaderboard/use-leaderboard", () => ({
  useLeaderboardData: () => ({
    data: null,
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/route-transition", () => ({
  navigateWithRouteTransition: (callback: () => void) => callback(),
}));

const input = {
  nearLearnedCount: 2,
  nearLevelUpCount: 1,
  rankProgressPercent: 50,
  pointsToNextRank: 100,
  accuracy: 80,
  incorrectCount: 2,
  answeredCount: 10,
  remainingActiveCards: 8,
  gainedXp: 10,
  gainedGems: 0,
  earnedMedals: 3,
  chestWasMissed: false,
  chestMissedByPercentagePoints: 0,
};

describe("QuizContinuationMotivationView", () => {
  it("routes the random-card action back to the landing draw overlay with the learning language", () => {
    routerPushMock.mockReset();

    render(
      <QuizContinuationMotivationView
        input={{ ...input, remainingActiveCards: 0 }}
        hasMoreCardsToLearn={false}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(document.body.querySelector('[data-continuation-card-addition="random"]')!);

    expect(routerPushMock).toHaveBeenCalledWith("/?mission-action=draw-cards&language=en");
    expect(document.body.querySelectorAll("[data-continuation-card-addition]")).toHaveLength(3);
    expect(document.body.querySelector("[data-continuation-card-additions] h3")).toHaveTextContent("quiz.continuation.addToDeckTitle");
  });

  it("keeps the result actions and pins the card-addition row to the bottom when cards remain", () => {
    const { container } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.querySelectorAll("[data-quiz-continuation-motivation-card]")).toHaveLength(3);
    expect(container.querySelector("[data-quiz-continuation-motivation-list]")).toHaveClass(
      "quiz-continuation-stagger-enter",
    );
    expect(container.querySelector('[data-continuation-action="leaderboard"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="continue"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="menu"]')).toBeInTheDocument();

    const additionPanel = document.body.querySelector("[data-continuation-card-additions]");
    expect(additionPanel).toHaveClass("fixed", "bottom-0");
    expect(container.querySelector("[data-continuation-card-additions]")).not.toBeInTheDocument();
    expect(additionPanel?.querySelector("h3")).toHaveTextContent("quiz.continuation.addToDeckTitle");
    expect(additionPanel?.querySelector("h3")).toHaveClass("font-super-water", "text-center");
    expect(additionPanel?.querySelectorAll("[data-continuation-card-addition]")).toHaveLength(3);
    const randomButton = additionPanel?.querySelector('[data-continuation-card-addition="random"]');
    expect(randomButton).toHaveClass(
      "rounded-2xl",
      "bg-[#f59e0b]",
    );
    expect(randomButton?.firstElementChild?.tagName).toBe("IMG");
    expect(randomButton).toHaveClass("min-h-[7.75rem]", "justify-start", "pt-1");
    expect(randomButton?.firstElementChild).toHaveClass("size-14");
    expect(randomButton).toHaveClass("text-white");
    expect(randomButton?.lastElementChild).toHaveClass(
      "font-super-water",
      "text-lg",
      "sm:text-xl",
      "flex-1",
      "items-center",
      "justify-center",
    );
    expect(additionPanel?.querySelector('[data-continuation-card-addition="custom"]')).toHaveClass(
      "bg-[#c026d3]",
    );
    expect(additionPanel?.querySelector('[data-continuation-card-addition="groups"]')).toHaveClass(
      "bg-[#84cc16]",
    );
  });

  it.each([
    ["random", "draw-cards"],
    ["custom", "create-card"],
    ["groups", "card-groups"],
  ] as const)("routes the %s card-addition choice to its landing overlay", (choice, action) => {
    routerPushMock.mockReset();

    render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        learningLanguage="tr"
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(document.body.querySelector(`[data-continuation-card-addition="${choice}"]`)!);

    expect(routerPushMock).toHaveBeenCalledWith(`/?mission-action=${action}&language=tr`);
  });

  it("enters its visible UI from top to bottom without the horizontal flow transition", () => {
    const { container } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        enterWithTransition
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const root = container.querySelector("[data-quiz-continuation-motivation]");
    const leaderboard = container.querySelector("[data-quiz-continuation-leaderboard]");
    const speech = container.querySelector("[data-quiz-continuation-speech]");
    const actions = container.querySelector("[data-quiz-continuation-actions]");

    expect(root).not.toHaveClass("quiz-flow-enter-right", "quiz-flow-exit-left");
    expect(root).not.toHaveClass("quiz-continuation-motivation-enter");
    expect(leaderboard).toHaveClass("quiz-continuation-stagger-enter");
    expect(leaderboard).toHaveClass("z-20", "pointer-events-auto");
    expect(speech).toHaveClass("quiz-continuation-stagger-enter");
    expect(speech?.parentElement).toHaveClass("-top-[60px]");
    expect(actions).toHaveClass("quiz-continuation-stagger-enter");
    expect(leaderboard).toHaveAttribute("style", expect.stringContaining("--quiz-continuation-delay: 0ms"));
    expect(speech).toHaveAttribute("style", expect.stringContaining("--quiz-continuation-delay: 90ms"));
    expect(actions).toHaveAttribute("style", expect.stringContaining("--quiz-continuation-delay: 280ms"));
  });

  it("keeps the leaderboard card last and replaces its placeholder when data arrives", () => {
    const { container, rerender, getByText } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const cards = container.querySelectorAll("[data-quiz-continuation-motivation-card]");
    expect(cards[cards.length - 1]).toHaveAttribute(
      "data-quiz-continuation-motivation-card",
      "leaderboard",
    );
    expect(getByText(/quiz\.continuation\.motivation\.leaderboardPlaceholder/)).toBeInTheDocument();

    rerender(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        leaderboardData={{
          mode: "points",
          viewer: {
            userId: "user-1",
            position: 7,
            pointsPosition: 7,
            streakPosition: 3,
            medalsPosition: 5,
            displayName: "Fox",
            totalPoints: 420,
            streak: 0,
            medals: 12,
            leaderboardVisible: true,
          },
          entries: [],
          canViewLeaderboard: true,
        }}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(getByText("quiz.continuation.motivation.leaderboard:420,7")).toBeInTheDocument();
    expect(
      container.querySelector('[data-quiz-continuation-motivation-card="leaderboard"] img'),
    ).toHaveClass("scale-75");

    rerender(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        leaderboardData={{
          mode: "points",
          viewer: {
            userId: "user-1",
            position: 1,
            pointsPosition: 1,
            streakPosition: 3,
            medalsPosition: 5,
            displayName: "Fox",
            totalPoints: 900,
            streak: 0,
            medals: 12,
            leaderboardVisible: true,
          },
          entries: [],
          canViewLeaderboard: true,
        }}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(getByText(/quiz\.continuation\.motivation\.leaderboardFirst/)).toBeInTheDocument();
  });

  it("replaces the legacy actions and keeps the draw-card reason available", () => {
    const { container } = render(
      <QuizContinuationMotivationView
        input={{ ...input, remainingActiveCards: 0 }}
        hasMoreCardsToLearn={false}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const cards = container.querySelectorAll("[data-quiz-continuation-motivation-card]");
    expect(cards[cards.length - 1]).toHaveAttribute(
      "data-quiz-continuation-motivation-card",
      "leaderboard",
    );
    expect(container.querySelector('[data-quiz-continuation-motivation-card="drawCards"]')).toBeInTheDocument();
    expect(document.body.querySelector('[data-continuation-action="draw-cards"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="continue"]')).not.toBeInTheDocument();
  });

  it("shows each leaderboard position and opens the matching mode", () => {
    openLeaderboardMock.mockReset();

    const { container } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        leaderboardData={{
          mode: "points",
          viewer: {
            userId: "user-1",
            position: 7,
            pointsPosition: 7,
            streakPosition: 3,
            medalsPosition: 5,
            displayName: "Fox",
            totalPoints: 420,
            streak: 8,
            medals: 12,
            leaderboardVisible: true,
          },
          entries: [],
          canViewLeaderboard: true,
        }}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-leaderboard-motivation-display="points"]'))
      .toHaveTextContent("7.");
    expect(container.querySelector('[data-leaderboard-motivation-display="streaks"]'))
      .toHaveTextContent("3.");
    expect(container.querySelector('[data-leaderboard-motivation-display="medals"]'))
      .toHaveTextContent("5.");

    fireEvent.click(container.querySelector('[data-leaderboard-motivation-display="streaks"]')!);
    fireEvent.click(container.querySelector('[data-leaderboard-motivation-display="medals"]')!);

    expect(openLeaderboardMock).toHaveBeenNthCalledWith(1, "streaks");
    expect(openLeaderboardMock).toHaveBeenNthCalledWith(2, "medals");
  });

  it("uses the review character, title, motivations, and replay action for learned quizzes", () => {
    const { container, getByText } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn={false}
        isReviewQuiz
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-review-quiz="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="review-replay"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="draw-cards"]')).not.toBeInTheDocument();
    expect(getByText("quiz.continuation.reviewTitle")).toBeInTheDocument();
    expect(container.querySelectorAll("img").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    expect(document.body.querySelector("[data-continuation-card-additions]")).not.toBeInTheDocument();
  });
});
