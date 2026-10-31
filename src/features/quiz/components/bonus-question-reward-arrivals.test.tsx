import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { BonusQuestionView } from "./bonus-question-view";

vi.mock("@/features/progress/components/reward-scatter", async () => {
  const React = await import("react");

  return {
    RewardScatter: (props: {
      gems?: unknown;
      onGemArrive?: (type: "blue" | "green" | "purple", amountAwarded: number) => void;
    }) => {
      const firedRef = React.useRef(false);
      React.useEffect(() => {
        if (!props.gems || firedRef.current) return;
        firedRef.current = true;
        props.onGemArrive?.("blue", 6);
      }, [props.gems, props.onGemArrive]);
      return null;
    },
  };
});

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));

const question = {
  kind: "matching" as const,
  pairs: [{ id: "one", cardId: "card-one", term: "apple", meaning: "elma" }],
  terms: [{ id: "one", cardId: "card-one", term: "apple", meaning: "elma" }],
  meanings: [{ id: "one", cardId: "card-one", term: "apple", meaning: "elma" }],
};

describe("BonusQuestionView reward arrivals", () => {
  it("forwards the exact arrived gem amount to its HUD owner", async () => {
    const onGemArrive = vi.fn();

    render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={question}
          showingAnswer
          answerAccepted
          rewardReady
          rewardRevealVisible
          gemRewards={[{ type: "blue", amount: 10 }]}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
          onGemArrive={onGemArrive}
        />
      </LocaleProvider>,
    );

    fireEvent.click(document.body.querySelector("[data-bonus-reward-reveal]")!);

    await waitFor(() => expect(onGemArrive).toHaveBeenCalledWith("blue", 6));
  });
});
