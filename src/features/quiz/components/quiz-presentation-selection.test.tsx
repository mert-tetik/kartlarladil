import { StrictMode } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizPresentationSelection } from "@/features/quiz/components/quiz-presentation-selection";
import { LocaleProvider } from "@/i18n/locale-provider";
import {
  preloadQuizPresentationSelectionImages,
  QUIZ_PRESENTATION_SELECTION_ARTWORK,
  QUIZ_PRESENTATION_SELECTION_IMAGE_SOURCES,
} from "@/features/quiz/quiz-video-preload";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));

function renderSelection() {
  return render(
    <StrictMode>
      <LocaleProvider initialLocale="en">
        <QuizPresentationSelection preparing={false} onSelect={vi.fn()} />
      </LocaleProvider>
    </StrictMode>,
  );
}

function classicArtworkSource(container: HTMLElement) {
  return container.querySelector<HTMLImageElement>(
    '[data-quiz-presentation-artwork="classic"] img',
  )?.getAttribute("src");
}

describe("QuizPresentationSelection artwork", () => {
  afterEach(() => vi.restoreAllMocks());

  it("cycles classic illustrations in the 1, 5, 6, 2 order using in-memory state", () => {
    const expectedSources = [
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[0],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[4],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[5],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[1],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[0],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[4],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[5],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[1],
    ];
    const actualSources = expectedSources.map(() => {
      const screen = renderSelection();
      const source = classicArtworkSource(screen.container);
      screen.unmount();
      return source;
    });

    expect(actualSources).toEqual(expectedSources);
  });

  it("shows the easy-practice illustration and one classic illustration", () => {
    const { container } = renderSelection();
    const easyButton = container.querySelector('[data-quiz-presentation="easy"]');
    const easyArtwork = container.querySelector('[data-quiz-presentation-artwork="easy"]');
    expect(container.querySelector("[data-quiz-presentation-content]")).toHaveClass("-translate-y-10");
    expect(container.querySelector("#quiz-presentation-title")).toHaveClass(
      "-translate-y-[30px]",
      "text-4xl",
      "sm:text-5xl",
    );
    expect(container.querySelector('[data-quiz-presentation-option="easy"]')).toHaveClass("-translate-y-[15px]");
    const easyTitle = container.querySelector('[data-quiz-presentation-title="easy"]');
    const classicTitle = container.querySelector('[data-quiz-presentation-title="classic"]');
    expect(easyTitle).toHaveClass("text-3xl", "sm:text-4xl");
    expect(classicTitle).toHaveClass("text-3xl", "sm:text-4xl");
    expect(easyTitle?.parentElement).toHaveClass("-translate-x-[20px]");
    expect(classicTitle?.parentElement).toHaveClass("-translate-x-[20px]");
    expect(easyTitle?.parentElement?.children).toHaveLength(1);
    expect(classicTitle?.parentElement?.children).toHaveLength(1);
    expect(easyButton).toHaveAttribute("data-quiz-presentation-button");
    expect(container.querySelector('[data-quiz-presentation="classic"]'))
      .toHaveAttribute("data-quiz-presentation-button");

    expect(container.querySelector('[data-quiz-presentation-artwork="easy"] img'))
      .toHaveAttribute("src", QUIZ_PRESENTATION_SELECTION_ARTWORK.easy);
    expect(easyButton).toHaveClass(
      "min-h-44",
      "sm:min-h-52",
      "overflow-visible",
    );
    expect(easyArtwork?.parentElement).toBe(easyButton?.parentElement);
    expect(easyArtwork).toHaveClass(
      "absolute",
      "z-[30]",
      "-left-[3px]",
      "bottom-0",
      "pointer-events-none",
      "origin-bottom-left",
      "h-[188px]",
      "sm:h-[220px]",
      "scale-[1.2]",
      "sm:scale-[1.14]",
      "md:scale-[1.2]",
    );
    expect([
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[0],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[4],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[5],
      QUIZ_PRESENTATION_SELECTION_ARTWORK.classic[1],
    ]).toContain(classicArtworkSource(container));
    expect(container.querySelector('[data-quiz-presentation-artwork="classic"]'))
      .toHaveClass("left-[32px]");
    expect(container.querySelectorAll("[data-quiz-presentation-artwork]")).toHaveLength(2);
  });

  it("moves the button and artwork as one synchronized hop on press", () => {
    const { container } = renderSelection();
    const easyButton = container.querySelector<HTMLButtonElement>("[data-quiz-presentation=\"easy\"]");

    fireEvent.click(easyButton!);

    const pressedButton = container.querySelector("[data-quiz-presentation=\"easy\"]");
    expect(pressedButton).toHaveAttribute("data-quiz-answer-feedback", "correct");
    expect(pressedButton).toHaveClass("quiz-presentation-button-correct");
    expect(pressedButton?.parentElement).toHaveAttribute("data-quiz-presentation-option", "easy");
    expect(pressedButton?.parentElement?.querySelector("[data-quiz-presentation-artwork]"))
      .toHaveClass("z-[30]");
  });

  it("preloads and decodes both mode images and every classic variant", () => {
    const images: HTMLImageElement[] = [];
    function MockImage(this: HTMLImageElement) {
      const image = document.createElement("img");
      image.decode = vi.fn().mockResolvedValue(undefined);
      images.push(image);
      return image;
    }
    vi.spyOn(window, "Image").mockImplementation(
      MockImage as unknown as typeof Image,
    );

    preloadQuizPresentationSelectionImages();

    expect(images.map((image) => image.src).sort()).toEqual(
      QUIZ_PRESENTATION_SELECTION_IMAGE_SOURCES
        .map((source) => new URL(source, window.location.href).href)
        .sort(),
    );
    images.forEach((image) => expect(image.decode).toHaveBeenCalledOnce());
  });
});
