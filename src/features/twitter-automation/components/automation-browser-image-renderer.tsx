"use client";

import Image from "next/image";
import { toPng } from "html-to-image";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { SelfSocialImage, type SelfSocialImageMode } from "@/features/twitter-automation/components/self-social-image";
import { VocabularyCarouselIntro } from "@/features/twitter-automation/components/vocabulary-carousel-intro";
import { VocabularyCarouselPost } from "@/features/twitter-automation/components/vocabulary-carousel-post";
import { WordOfTheDayImage } from "@/features/twitter-automation/components/word-of-the-day-image";
import { BrowserImageRenderError, browserImageFailureCode, retryBrowserImageOperation } from "@/features/twitter-automation/browser-image-retry";
import {
  isSelfExampleSentencesContent,
  type SelfExampleSentencesContent,
} from "@/features/twitter-automation/self-example-sentences";
import {
  isSelfFalseFriendsContent,
  type SelfFalseFriendsContent,
} from "@/features/twitter-automation/self-false-friends";
import {
  isSelfVocabularyProgressionContent,
  type SelfVocabularyProgressionContent,
} from "@/features/twitter-automation/self-vocabulary-progression";
import { createNativeVisualCaption, createWordOfTheDayCaption, getWordOfTheDayTitle } from "@/features/twitter-automation/social-video-titles";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

const SELF_IMAGE_GENERATORS = ["self-mini-quiz", "self-false-friends", "self-daily-challenge", "self-vocabulary-progression", "self-example-sentences"] as const;
const CAROUSEL_GENERATORS = ["vocabulary-carousel", "tier-progression-carousel"] as const;
const POSTER_TIER_PALETTES: Record<Tier, { base: string; deep: string; accent: string }> = {
  A1: { base: "#047857", deep: "#043c2d", accent: "#a7f3d0" },
  A2: { base: "#0369a1", deep: "#083b5c", accent: "#bae6fd" },
  B1: { base: "#6331c5", deep: "#3b176f", accent: "#ddd6fe" },
  B2: { base: "#b45309", deep: "#642d0a", accent: "#fde68a" },
  C1: { base: "#be123c", deep: "#6d0c29", accent: "#fecdd3" },
};

export type AutomationBrowserImageOutput = {
  id: string;
  generator: string;
  language: LanguageCode;
  native_language: LanguageCode;
  tier: Tier;
};

type BrowserVisualContent =
  | { kind: "word"; card: VocabularyCard; mode: "card" | "poster"; caption: string }
  | {
    kind: "self";
    mode: SelfSocialImageMode;
    cards: VocabularyCard[];
    falseFriends: SelfFalseFriendsContent | null;
    exampleSentences: SelfExampleSentencesContent | null;
    vocabularyProgression: SelfVocabularyProgressionContent | null;
    caption: string;
  }
  | { kind: "carousel"; cards: VocabularyCard[]; mode: "vocabulary" | "tier"; caption: string };

type AutomationBrowserImageRendererProps = {
  output: AutomationBrowserImageOutput;
  onStart: () => void;
  onComplete: (result: { caption: string; imageDataUrls: string[] }) => void;
  onError: (error: unknown) => void;
};

function isSelfImageGenerator(value: string): value is SelfSocialImageMode {
  return (SELF_IMAGE_GENERATORS as readonly string[]).includes(value);
}

function isCarouselGenerator(value: string): value is (typeof CAROUSEL_GENERATORS)[number] {
  return (CAROUSEL_GENERATORS as readonly string[]).includes(value);
}

function sourceGenerator(generator: string) {
  return generator.startsWith("music-") ? generator.slice("music-".length) : generator;
}

function isMusicSource(generator: string) {
  return generator.startsWith("music-");
}

function cardViewProps(card: VocabularyCard, face: "front" | "back", translationLocale: LanguageCode): ComponentProps<typeof VocabularyCardView> {
  return { card, face, flippable: false, frontFit: true, showActions: false, staticFace: false, translationLocale };
}

function randomCarouselTiers() {
  const shuffled = [...TIERS].sort(() => Math.random() - 0.5);
  return [...shuffled, TIERS[Math.floor(Math.random() * TIERS.length)]!];
}

async function waitForImages(source: HTMLElement) {
  const images = Array.from(source.querySelectorAll("img"));
  await Promise.race([
    Promise.all(images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      await image.decode?.().catch(() => undefined);
    })),
    new Promise<void>((resolve) => window.setTimeout(resolve, 5_000)),
  ]);
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForSnapshotReady(sources: HTMLElement[]) {
  await document.fonts?.ready;
  await Promise.all(sources.map(waitForImages));
  await waitForAnimationFrame();
  await waitForAnimationFrame();
}

function requireImageSource(source: HTMLElement | null, errorCode: string) {
  if (!source || !source.getBoundingClientRect().width || !source.getBoundingClientRect().height) {
    throw new BrowserImageRenderError(errorCode);
  }
  return source;
}

function browserImageContentError(error: unknown) {
  return new BrowserImageRenderError(browserImageFailureCode(error, "browser_image_content_failed"));
}

function captionForSelfImage(mode: SelfSocialImageMode, learningLanguage: LanguageCode, nativeLanguage: LanguageCode) {
  const kind = mode === "self-mini-quiz"
    ? "miniQuiz"
    : mode === "self-false-friends"
      ? "falseFriends"
      : mode === "self-daily-challenge"
        ? "dailyChallenge"
        : mode === "self-vocabulary-progression"
          ? "vocabularyProgression"
          : "exampleSentences";
  const itemCount = mode === "self-mini-quiz" ? 1 : mode === "self-false-friends" ? 2 : 3;
  return createNativeVisualCaption({ kind, learningLanguage, nativeLanguage, itemCount });
}

function MusicWordOfTheDaySource({ card, nativeLanguage, mode }: { card: VocabularyCard; nativeLanguage: LanguageCode; mode: "card" | "poster" }) {
  if (mode === "card") {
    return <div className="social-card-export w-[1080px] bg-black px-12 py-20">
      <style>{`
        .social-card-export .social-card-front [data-card-face] > div,
        .social-card-export .social-card-back [data-card-face] > div,
        .social-card-export .social-card-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
        .social-card-export .social-card-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
        .social-card-export .social-card-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
      `}</style>
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-20">
        <div className="social-card-front w-[420px]"><VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} /></div>
        <div className="social-card-back w-[420px]"><VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} /></div>
      </div>
    </div>;
  }

  const palette = POSTER_TIER_PALETTES[card.tier];
  return <div className="relative h-[810px] w-[1080px] overflow-hidden px-16 py-14 text-white" style={{ backgroundColor: palette.base }}>
    <div className="absolute inset-0" style={{ background: `linear-gradient(142deg, ${palette.base} 0%, ${palette.deep} 100%)` }} />
    <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ backgroundColor: palette.deep }} />
    <div className="absolute inset-10 border" style={{ borderColor: `${palette.accent}a6` }} />
    <div className="absolute left-16 right-16 top-[34%] h-px" style={{ backgroundColor: `${palette.accent}8c` }} />
    <style>{`
      .social-video-poster-front [data-card-face] > div,
      .social-video-poster-back [data-card-face] > div,
      .social-video-poster-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
      .social-video-poster-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
      .social-video-poster-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
    `}</style>
    <div className="relative z-10">
      <div className="relative h-12 w-56 overflow-hidden"><Image alt="" className="object-cover object-[50%_48%]" fill sizes="14rem" src="/splash.png" unoptimized /></div>
      <h2 className="mt-2 max-w-md font-display text-5xl font-semibold leading-[0.92]">{LANGUAGE_BY_CODE[card.language].nativeName.toUpperCase()} {getWordOfTheDayTitle(card.language).toUpperCase()}</h2>
    </div>
    <div className="pointer-events-none absolute bottom-10 right-14 z-0 w-40 rotate-6"><Image alt="" className="h-auto w-full object-contain" height={512} src="/mascots/mascot16.webp" unoptimized width={512} /></div>
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-max -translate-x-1/2 -translate-y-1/2 items-center gap-20">
      <div className="social-video-poster-front w-[300px]"><VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} /></div>
      <div className="social-video-poster-back w-[300px]"><VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} /></div>
    </div>
    <p className="absolute bottom-14 left-16 z-10 max-w-[66%] text-xl font-semibold leading-8">{card.examples[0]?.sentence ?? card.example}</p>
  </div>;
}

export function AutomationBrowserImageRenderer({ output, onStart, onComplete, onError }: AutomationBrowserImageRendererProps) {
  const [content, setContent] = useState<BrowserVisualContent | null>(null);
  const wordRef = useRef<HTMLDivElement | null>(null);
  const selfRef = useRef<HTMLDivElement | null>(null);
  const carouselSlideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const startedForOutputId = useRef<string | null>(null);
  const completedForOutputId = useRef<string | null>(null);
  const generator = sourceGenerator(output.generator);
  const musicSource = isMusicSource(output.generator);

  useEffect(() => {
    if (startedForOutputId.current === output.id) return;
    startedForOutputId.current = output.id;
    completedForOutputId.current = null;
    carouselSlideRefs.current = [];
    onStart();
  }, [onStart, output.id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCard(tier: Tier, cardGenerator = "self-vocabulary-card") {
      const response = await fetch("/api/twitter-automation/card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, tier, generator: cardGenerator }),
      });
      const payload = await response.json().catch(() => null) as { card?: VocabularyCard; errorCode?: string } | null;
      if (!response.ok || !payload?.card) throw new Error(payload?.errorCode ?? "automation_card_generation_failed");
      return payload.card;
    }

    async function createContent() {
      if (generator === "word-of-the-day" || generator === "word-of-the-day-poster") {
        const card = await fetchCard(output.tier, generator);
        return { kind: "word", card, mode: generator === "word-of-the-day" ? "card" : "poster", caption: createWordOfTheDayCaption(card, output.native_language) } as BrowserVisualContent;
      }

      if (isSelfImageGenerator(generator)) {
        if (generator === "self-false-friends") {
          const response = await fetch("/api/twitter-automation/self-false-friends", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, recentTerms: [] }),
          });
          const payload = await response.json().catch(() => null) as { pair?: unknown; errorCode?: string } | null;
          if (!response.ok || !isSelfFalseFriendsContent(payload?.pair)) throw new Error(payload?.errorCode ?? "self_false_friends_generation_failed");
          return { kind: "self", mode: generator, cards: [], falseFriends: payload.pair, exampleSentences: null, vocabularyProgression: null, caption: captionForSelfImage(generator, output.language, output.native_language) } as BrowserVisualContent;
        }

        if (generator === "self-vocabulary-progression") {
          const response = await fetch("/api/twitter-automation/self-vocabulary-progression", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, recentTerms: [] }),
          });
          const payload = await response.json().catch(() => null) as { progression?: unknown; errorCode?: string } | null;
          if (!response.ok || !isSelfVocabularyProgressionContent(payload?.progression)) throw new Error(payload?.errorCode ?? "self_vocabulary_progression_generation_failed");
          return { kind: "self", mode: generator, cards: [], falseFriends: null, exampleSentences: null, vocabularyProgression: payload.progression, caption: captionForSelfImage(generator, output.language, output.native_language) } as BrowserVisualContent;
        }

        if (generator === "self-example-sentences") {
          const response = await fetch("/api/twitter-automation/self-example-sentences", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, recentSentences: [] }),
          });
          const payload = await response.json().catch(() => null) as { examples?: unknown; errorCode?: string } | null;
          if (!response.ok || !isSelfExampleSentencesContent(payload?.examples)) throw new Error(payload?.errorCode ?? "self_example_sentences_generation_failed");
          return { kind: "self", mode: generator, cards: [], falseFriends: null, exampleSentences: payload.examples, vocabularyProgression: null, caption: captionForSelfImage(generator, output.language, output.native_language) } as BrowserVisualContent;
        }

        const tiers = generator === "self-mini-quiz" ? [output.tier, output.tier, output.tier, output.tier] : [...TIERS].sort(() => Math.random() - 0.5).slice(0, 3);
        const cards = await Promise.all(tiers.map((tier) => fetchCard(tier)));
        if (new Set(cards.map((card) => card.sourceKey)).size !== cards.length) throw new Error("automation_duplicate_vocabulary_card");
        return { kind: "self", mode: generator, cards, falseFriends: null, exampleSentences: null, vocabularyProgression: null, caption: captionForSelfImage(generator, output.language, output.native_language) } as BrowserVisualContent;
      }

      if (isCarouselGenerator(generator)) {
        const tiers = generator === "vocabulary-carousel" ? randomCarouselTiers() : [...TIERS];
        const cards = await Promise.all(tiers.map((tier) => fetchCard(tier, generator)));
        if (new Set(cards.map((card) => card.sourceKey)).size !== cards.length) throw new Error("automation_duplicate_vocabulary_card");
        return {
          kind: "carousel",
          cards,
          mode: generator === "vocabulary-carousel" ? "vocabulary" : "tier",
          caption: createNativeVisualCaption({
            kind: generator === "vocabulary-carousel" ? "vocabularyCarousel" : "tierProgression",
            learningLanguage: output.language,
            nativeLanguage: output.native_language,
            itemCount: cards.length,
          }),
        } as BrowserVisualContent;
      }

      throw new Error("unsupported_browser_image_generator");
    }

    void createContent().then((nextContent) => {
      if (!cancelled) setContent(nextContent);
    }).catch((error: unknown) => {
      if (!cancelled) onError(browserImageContentError(error));
    });

    return () => { cancelled = true; };
  }, [generator, onError, output.id, output.language, output.native_language, output.tier]);

  useEffect(() => {
    if (!content || completedForOutputId.current === output.id) return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          let imageDataUrls: string[];
          if (content.kind === "word") {
            const source = requireImageSource(wordRef.current, "browser_word_image_unavailable");
            imageDataUrls = [await retryBrowserImageOperation(() => toPng(source, {
              cacheBust: true,
              pixelRatio: musicSource ? 1 : 3,
              backgroundColor: musicSource
                ? content.mode === "card" ? "#11100f" : POSTER_TIER_PALETTES[content.card.tier].base
                : content.mode === "card" ? "#ffffff" : POSTER_TIER_PALETTES[content.card.tier].base,
            }), {
              beforeAttempt: () => waitForSnapshotReady([source]),
              failureCode: "browser_image_snapshot_failed",
            })];
          } else if (content.kind === "self") {
            const source = requireImageSource(selfRef.current, "browser_self_image_unavailable");
            imageDataUrls = [await retryBrowserImageOperation(() => toPng(source, { cacheBust: true, pixelRatio: 1.5, backgroundColor: "#11100f" }), {
              beforeAttempt: () => waitForSnapshotReady([source]),
              failureCode: "browser_image_snapshot_failed",
            })];
          } else {
            const slides = carouselSlideRefs.current;
            if (slides.length !== content.cards.length + 1 || slides.some((slide) => !slide)) {
              throw new BrowserImageRenderError("browser_carousel_image_unavailable");
            }
            const sources = slides.map((slide) => requireImageSource(slide, "browser_carousel_image_unavailable"));
            imageDataUrls = await retryBrowserImageOperation(() => Promise.all(sources.map((source, index) => toPng(source, {
              cacheBust: true,
              pixelRatio: 1.5,
              backgroundColor: index === 0 ? "#f76808" : "#16120f",
            }))), {
              beforeAttempt: () => waitForSnapshotReady(sources),
              failureCode: "browser_image_snapshot_failed",
            });
          }
          if (!cancelled) {
            completedForOutputId.current = output.id;
            onComplete({ caption: content.caption, imageDataUrls });
          }
        } catch (error) {
          if (!cancelled) onError(error instanceof BrowserImageRenderError
            ? error
            : new BrowserImageRenderError("browser_image_snapshot_failed"));
        }
      })();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [content, musicSource, onComplete, onError, output.id]);

  if (!content) return null;

  return <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0 z-[-1]">
    {content.kind === "word" ? <div ref={wordRef}>
      {musicSource
        ? <MusicWordOfTheDaySource card={content.card} mode={content.mode} nativeLanguage={output.native_language} />
        : <WordOfTheDayImage card={content.card} mode={content.mode} nativeLanguage={output.native_language} />}
    </div> : null}
    {content.kind === "self" ? <div ref={selfRef}>
      <SelfSocialImage cards={content.cards} exampleSentences={content.exampleSentences} falseFriends={content.falseFriends} learningLanguage={output.language} mode={content.mode} nativeLanguage={output.native_language} vocabularyProgression={content.vocabularyProgression} />
    </div> : null}
    {content.kind === "carousel" ? <div className="w-[440px]">
      <VocabularyCarouselIntro learningLanguage={output.language} mode={content.mode} nativeLanguage={output.native_language} onSlideRef={(element) => { carouselSlideRefs.current[0] = element; }} wordCount={content.cards.length} />
      {content.cards.map((card, index) => <VocabularyCarouselPost card={card} key={card.sourceKey} nativeLanguage={output.native_language} onSlideRef={(element) => { carouselSlideRefs.current[index + 1] = element; }} presentation={content.mode === "tier" ? "tier" : "meaning"} />)}
    </div> : null}
  </div>;
}
