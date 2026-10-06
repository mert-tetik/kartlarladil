import { fireEvent, render } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getAiPracticeCharacter } from "@/features/ai-practice/ai-practice-data";
import { QuizSpeechBubble } from "./quiz-speech-bubble";

const character = getAiPracticeCharacter("gentle-companion")!;

function renderVideo() {
  return render(
    <LocaleProvider initialLocale="en">
      <QuizSpeechBubble
        character={character}
        term="Choose"
        language="en"
        showSpeaker={false}
        characterVideoSrc="/quiz/kac-kartla-calisacaksin.mp4"
      />
    </LocaleProvider>,
  );
}

describe("QuizSpeechBubble character video", () => {
  it("keeps the video hidden until it has loaded a playable frame", () => {
    const { container } = renderVideo();
    const video = container.querySelector<HTMLVideoElement>("[data-quiz-speech-character-video]");

    expect(video).toBeInTheDocument();
    expect(video).toHaveClass("opacity-0");
    expect(video).toHaveClass("invisible");

    fireEvent.loadedData(video!);

    expect(video).toHaveClass("opacity-100");
    expect(video).toHaveClass("visible");
  });

  it("removes the video when the browser reports that it is unavailable", () => {
    const { container } = renderVideo();
    const video = container.querySelector<HTMLVideoElement>("[data-quiz-speech-character-video]");

    fireEvent.error(video!);

    expect(container.querySelector("[data-quiz-speech-character-video]")).not.toBeInTheDocument();
  });
});
