import { render } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getAiPracticeCharacter } from "@/features/ai-practice/ai-practice-data";
import { QuizSpeechBubble } from "./quiz-speech-bubble";

const character = getAiPracticeCharacter("gentle-companion")!;

describe("QuizSpeechBubble character frames", () => {
  it("does not render a video player for a character without prebuilt frames", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <QuizSpeechBubble character={character} term="Choose" language="en" showSpeaker={false} />
      </LocaleProvider>,
    );

    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("shows count-selection copy while the mascot frames are still loading", () => {
    const { container, getByRole } = render(
      <LocaleProvider initialLocale="en">
        <QuizSpeechBubble
          character={character}
          term="Choose"
          language="en"
          showSpeaker={false}
          characterFrameSources={["/quiz/count-selection-frames/frame-001.webp"]}
          showBubbleWhileCharacterLoads
        />
      </LocaleProvider>,
    );
    const bubble = container.querySelector("[data-quiz-speech-bubble]");

    expect(getByRole("heading", { name: "Choose" })).toBeVisible();
    expect(bubble).not.toHaveClass("opacity-0");
    expect(container.querySelector("[data-quiz-speech-character-frames]")).toHaveAttribute(
      "fetchPriority",
      "high",
    );
  });
});
