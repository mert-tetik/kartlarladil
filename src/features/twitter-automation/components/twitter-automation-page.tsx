"use client";

import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, Database, Download, ImageIcon, ListChecks, LockKeyhole, MessageSquareText, RefreshCw, Star, Video } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { AutomationTable } from "@/features/twitter-automation/components/automation-table";
import { ScheduledPostsTable } from "@/features/twitter-automation/components/scheduled-posts-table";
import { SocialMediasTable } from "@/features/twitter-automation/components/social-medias-table";
import { SocialPublishActions, type SocialPublishAsset, type SocialPublishImageAsset } from "@/features/twitter-automation/components/social-publish-actions";
import { VocabularyCarouselPost } from "@/features/twitter-automation/components/vocabulary-carousel-post";
import { stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { renderConfusedWordsVideo, type ConfusedWordsVideoScene } from "@/features/twitter-automation/confused-words-video-renderer";
import { renderDialogueVideo, type DialogueVideoScene } from "@/features/twitter-automation/dialogue-video-renderer";
import { MUSIC_VIDEO_DURATION_SECONDS, prepareMusicVideoAudio, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";
import { renderOriginalMascotLearningVideo } from "@/features/twitter-automation/original-mascot-learning-video-renderer";
import type { OriginalMascotLearningVideoMode, OriginalMascotLearningVideoPayload } from "@/features/twitter-automation/original-mascot-learning-video";
import { formatSocialStudioClientFailure, formatSocialStudioFailure, type SocialStudioFailurePayload } from "@/features/twitter-automation/social-studio-diagnostics";
import { SOCIAL_CONTENT_STUDIO_VERSION } from "@/features/twitter-automation/social-studio-version";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type StudioMode = "text" | "image" | "video";
type TextGeneratorMode = "fun-post" | "word-quiz" | "language-tip" | "false-friends" | "daily-challenge" | "relatable-learner";
type AiImageGeneratorMode = "ai-word-of-the-day" | "ai-mini-quiz" | "ai-false-friends" | "ai-daily-challenge" | "ai-vocabulary-progression";
type VocabularyCarouselGeneratorMode = "vocabulary-carousel";
type TierProgressionCarouselGeneratorMode = "tier-progression-carousel";
type ImageGeneratorMode = "word-of-the-day" | "word-of-the-day-poster" | VocabularyCarouselGeneratorMode | TierProgressionCarouselGeneratorMode | AiImageGeneratorMode;
type MusicVideoImageGeneratorMode = Exclude<ImageGeneratorMode, VocabularyCarouselGeneratorMode | TierProgressionCarouselGeneratorMode>;
type MusicVideoGeneratorMode = `music-${MusicVideoImageGeneratorMode}`;
type ConfusedWordsVideoGeneratorMode = "confused-words-video";
type DialogueVideoGeneratorMode = "marketing-dialogue-video" | "learning-dialogue-video";
type OriginalMascotLearningVideoGeneratorMode = OriginalMascotLearningVideoMode;
type VideoGeneratorMode = "ai-word-of-the-day-video" | ConfusedWordsVideoGeneratorMode | DialogueVideoGeneratorMode | OriginalMascotLearningVideoGeneratorMode | MusicVideoGeneratorMode;
type GeneratorMode = TextGeneratorMode | ImageGeneratorMode | VideoGeneratorMode;
type AiImageTaskStatus = "idle" | "running" | "finished" | "failed";
type AiVideoTaskStatus = "idle" | "preparing" | "queued" | "running" | "finished" | "failed";
type MusicVideoTaskStatus = "idle" | "creating-image" | "rendering" | "finished" | "failed";
type ConfusedWordsCardPair = { first: VocabularyCard; second: VocabularyCard };
type DialogueVoiceCast = Array<{ mascot: string; voice: string }>;

type GeneratorOption = { value: GeneratorMode; label: string; description: string };

const STUDIO_MODES: Array<{ value: StudioMode; label: string; description: string; icon: typeof MessageSquareText }> = [
  { value: "text", label: "Text", description: "Captions and GPT posts", icon: MessageSquareText },
  { value: "image", label: "Image", description: "Downloadable card visuals", icon: ImageIcon },
  { value: "video", label: "Video", description: "Lip-sync and music video exports", icon: Video },
];

const TEXT_GENERATOR_OPTIONS: Array<{ value: TextGeneratorMode; label: string; description: string }> = [
  { value: "fun-post", label: "Fun FoxiesDeck Post", description: "A playful GPT post about the app" },
  { value: "word-quiz", label: "Word Quiz", description: "A quick multiple-choice vocabulary challenge" },
  { value: "language-tip", label: "Language Tip", description: "A concise grammar, usage, or pronunciation tip" },
  { value: "false-friends", label: "False Friends", description: "Two easy-to-confuse words, clearly explained" },
  { value: "daily-challenge", label: "Daily Challenge", description: "A small set of words to learn today" },
  { value: "relatable-learner", label: "Relatable Learner Post", description: "A funny, familiar language-learning moment" },
];

const AI_IMAGE_GENERATOR_OPTIONS: Array<{ value: AiImageGeneratorMode; label: string; description: string }> = [
  { value: "ai-word-of-the-day", label: "Word of the Day Campaign", description: "A polished hero visual around one real word card" },
  { value: "ai-mini-quiz", label: "Mini Quiz", description: "A social quiz visual built around one vocabulary word" },
  { value: "ai-false-friends", label: "False Friends", description: "Two similar-looking words from the selected language, clearly contrasted" },
  { value: "ai-daily-challenge", label: "Daily Challenge", description: "A three-word study challenge visual" },
  { value: "ai-vocabulary-progression", label: "Beginner to Advanced", description: "Beginner words beside their advanced alternatives" },
];

const IMAGE_GENERATOR_OPTIONS: Array<{ value: ImageGeneratorMode; label: string; description: string }> = [
  { value: "word-of-the-day", label: "Word of the Day", description: "A real card visual with its ready-to-post caption" },
  { value: "word-of-the-day-poster", label: "Word of the Day poster", description: "A single social image with the post copy built in" },
  { value: "vocabulary-carousel", label: "Vocabulary Carousel", description: "Six non-AI 3:4 card visuals for one carousel post" },
  { value: "tier-progression-carousel", label: "A1 to C1 Carousel", description: "Three non-AI 3:4 cards at A1, B2, and C1" },
  ...AI_IMAGE_GENERATOR_OPTIONS,
];

const MUSIC_VIDEO_IMAGE_GENERATOR_OPTIONS: Array<{ value: MusicVideoImageGeneratorMode; label: string; description: string }> = [
  { value: "word-of-the-day", label: "Word of the Day", description: "A real card visual with its ready-to-post caption" },
  { value: "word-of-the-day-poster", label: "Word of the Day poster", description: "A single social image with the post copy built in" },
  ...AI_IMAGE_GENERATOR_OPTIONS,
];

const VIDEO_GENERATOR_OPTIONS: Array<{ value: VideoGeneratorMode; label: string; description: string }> = [
  { value: "ai-word-of-the-day-video", label: "Word of the Day", description: "A lip-synced FoxiesDeck mascot explainer" },
  { value: "confused-words-video", label: "Confused Words", description: "A three-phase vertical mascot explainer for six similar words" },
  { value: "marketing-dialogue-video", label: "FoxiesDeck Dialogue", description: "A two-character marketing conversation in the native language" },
  { value: "learning-dialogue-video", label: "Everyday Dialogue", description: "A two-character conversation in the learning language with translations" },
  { value: "tier-progression-video", label: "A1 to C1 Video", description: "Original mascot explains an A1, B1, and C1 word progression" },
  { value: "vocabulary-quiz-video", label: "Vocabulary Quiz Video", description: "Original mascot asks a timed four-choice meaning quiz" },
  { value: "sentence-check-video", label: "Sentence Check Video", description: "Original mascot runs a timed correct-or-incorrect sentence challenge" },
  ...MUSIC_VIDEO_IMAGE_GENERATOR_OPTIONS.map((option) => ({
    value: `music-${option.value}` as MusicVideoGeneratorMode,
    label: `${option.label} Music Video`,
    description: `A ${MUSIC_VIDEO_DURATION_SECONDS}-second visual loop with a licensed social-video soundtrack`,
  })),
];

const SOCIAL_VIDEO_MUSIC_TRACKS = [
  { label: "Music 1", url: "/social-audio/music1.mp3" },
  { label: "Music 2", url: "/social-audio/music2.mp3" },
  { label: "Music 3", url: "/social-audio/music3.mp3" },
  { label: "Music 4", url: "/social-audio/music4.mp3" },
  { label: "Music 5", url: "/social-audio/music5.mp3" },
  { label: "Music 6", url: "/social-audio/music6.mp3" },
  { label: "Music 7", url: "/social-audio/music7.mp3" },
] as const;

const GENERATOR_OPTIONS = {
  text: [
    ...TEXT_GENERATOR_OPTIONS,
  ],
  image: [
    ...IMAGE_GENERATOR_OPTIONS,
  ],
  video: [
    ...VIDEO_GENERATOR_OPTIONS,
  ],
};

const DEFAULT_HIGHLIGHTED_GENERATOR_MODES: readonly GeneratorMode[] = [
  "vocabulary-carousel",
  "tier-progression-carousel",
  "confused-words-video",
  "marketing-dialogue-video",
  "learning-dialogue-video",
  "tier-progression-video",
  "vocabulary-quiz-video",
  "sentence-check-video",
];

const LANGUAGE_OPTIONS = Object.values(LANGUAGE_BY_CODE);
const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

const POSTER_TIER_PALETTES: Record<Tier, { base: string; deep: string; accent: string }> = {
  A1: { base: "#047857", deep: "#043c2d", accent: "#a7f3d0" },
  A2: { base: "#0369a1", deep: "#083b5c", accent: "#bae6fd" },
  B1: { base: "#6331c5", deep: "#3b176f", accent: "#ddd6fe" },
  B2: { base: "#b45309", deep: "#642d0a", accent: "#fde68a" },
  C1: { base: "#be123c", deep: "#6d0c29", accent: "#fecdd3" },
};

function createWordCaption(card: VocabularyCard) {
  const language = ENGLISH_LANGUAGE_NAMES[card.language].toUpperCase();
  const example = card.examples[0]?.sentence ?? card.example;
  const tag = ENGLISH_LANGUAGE_NAMES[card.language].toLowerCase().replaceAll(" ", "");
  return `${language} WORD OF THE DAY!! ${example}\n\n#${tag} #language #wordoftheday`;
}

function isCardGenerator(mode: GeneratorMode) {
  return mode === "word-of-the-day" || mode === "word-of-the-day-poster";
}

function isTextGenerator(mode: GeneratorMode): mode is TextGeneratorMode {
  return TEXT_GENERATOR_OPTIONS.some((option) => option.value === mode);
}

function isAiImageGenerator(mode: GeneratorMode): mode is AiImageGeneratorMode {
  return AI_IMAGE_GENERATOR_OPTIONS.some((option) => option.value === mode);
}

function isVocabularyCarouselGenerator(mode: GeneratorMode): mode is VocabularyCarouselGeneratorMode {
  return mode === "vocabulary-carousel";
}

function isTierProgressionCarouselGenerator(mode: GeneratorMode): mode is TierProgressionCarouselGeneratorMode {
  return mode === "tier-progression-carousel";
}

function isCarouselImageGenerator(mode: GeneratorMode): mode is VocabularyCarouselGeneratorMode | TierProgressionCarouselGeneratorMode {
  return isVocabularyCarouselGenerator(mode) || isTierProgressionCarouselGenerator(mode);
}

function isAiVideoGenerator(mode: GeneratorMode): mode is "ai-word-of-the-day-video" {
  return mode === "ai-word-of-the-day-video";
}

function isMusicVideoGenerator(mode: GeneratorMode): mode is MusicVideoGeneratorMode {
  return VIDEO_GENERATOR_OPTIONS.some((option) => option.value === mode) && mode.startsWith("music-");
}

function isConfusedWordsVideoGenerator(mode: GeneratorMode): mode is ConfusedWordsVideoGeneratorMode {
  return mode === "confused-words-video";
}

function isDialogueVideoGenerator(mode: GeneratorMode): mode is DialogueVideoGeneratorMode {
  return mode === "marketing-dialogue-video" || mode === "learning-dialogue-video";
}

function isOriginalMascotLearningVideoGenerator(mode: GeneratorMode): mode is OriginalMascotLearningVideoGeneratorMode {
  return mode === "tier-progression-video" || mode === "vocabulary-quiz-video" || mode === "sentence-check-video";
}

function generatorContentSource(mode: GeneratorMode): "AI" | "SELF" | "IMG" {
  if (isTextGenerator(mode) || isAiImageGenerator(mode) || isAiVideoGenerator(mode)) return "AI";
  if (isMusicVideoGenerator(mode)) return "IMG";
  return "SELF";
}

function originalMascotLearningVideoLabel(mode: OriginalMascotLearningVideoGeneratorMode) {
  return mode === "tier-progression-video" ? "A1 to C1 progression" : mode === "vocabulary-quiz-video" ? "Vocabulary quiz" : "Sentence check";
}

function originalMascotLearningVideoDescription(mode: OriginalMascotLearningVideoGeneratorMode) {
  return mode === "tier-progression-video"
    ? "Original mascot explains three semantically connected A1, B1, and C1 words with tier-color highlights."
    : mode === "vocabulary-quiz-video"
      ? "Original mascot presents a four-choice vocabulary quiz, then reveals and explains the answer."
      : "Original mascot asks whether a sentence is correct, gives four seconds with a ticking clock, then explains the answer.";
}

function getMusicVideoImageMode(mode: MusicVideoGeneratorMode): MusicVideoImageGeneratorMode {
  return mode.slice("music-".length) as MusicVideoImageGeneratorMode;
}

function aiImageUsesTier(mode: AiImageGeneratorMode) {
  return mode === "ai-word-of-the-day" || mode === "ai-mini-quiz" || mode === "ai-daily-challenge";
}

function randomCarouselTiers(): Tier[] {
  const shuffled = [...TIERS].sort(() => Math.random() - 0.5);
  return [...shuffled, TIERS[Math.floor(Math.random() * TIERS.length)]!];
}

function GeneratorModeOption({
  highlighted,
  onSelect,
  onToggleHighlight,
  option,
  selected,
}: {
  highlighted: boolean;
  onSelect: () => void;
  onToggleHighlight: () => void;
  option: GeneratorOption;
  selected: boolean;
}) {
  const contentSource = generatorContentSource(option.value);
  return (
    <div className="relative">
      <button
        className={cn(
          "w-full rounded-lg border p-3 pr-24 text-left transition-colors",
          highlighted
            ? selected ? "border-[#ffd36b] bg-[#f5ac27] text-[#251106]" : "border-[#cf8f17] bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]"
            : selected ? "border-[#f5ac27] bg-[#2b211d]" : "border-white/10 hover:bg-[#231d19]",
        )}
        onClick={onSelect}
        type="button"
      >
        <span className="block text-sm font-semibold">{option.label}</span>
        <span className={cn("mt-1 block text-xs leading-5", highlighted ? "text-black/70" : "text-[#cdbfb3]")}>{option.description}</span>
      </button>
      <span className={cn("pointer-events-none absolute right-10 top-3 text-[10px] font-semibold", highlighted ? "text-black/70" : "text-[#a8a29e]")}>{contentSource}</span>
      <button
        aria-label={highlighted ? `Remove highlight from ${option.label}` : `Highlight ${option.label}`}
        className={cn(
          "absolute right-2 top-2 flex size-8 items-center justify-center rounded-md transition-colors",
          highlighted ? "text-[#251106] hover:bg-black/10" : "text-[#a8a29e] hover:bg-white/10 hover:text-[#f5ac27]",
        )}
        onClick={onToggleHighlight}
        type="button"
      >
        <Star className="size-4" fill={highlighted ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SocialContentStudioPage({ view = "studio" }: { view?: "studio" | "automations" | "social-medias" | "scheduled-posts" }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [studioMode, setStudioMode] = useState<StudioMode>("text");
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>("fun-post");
  const [highlightedGeneratorModes, setHighlightedGeneratorModes] = useState<Set<GeneratorMode>>(() => new Set(DEFAULT_HIGHLIGHTED_GENERATOR_MODES));
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>("en");
  const [tier, setTier] = useState<Tier>("A1");
  const [card, setCard] = useState<VocabularyCard | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState("");
  const [posterImageUrl, setPosterImageUrl] = useState("");
  const [localImageRenderError, setLocalImageRenderError] = useState("");
  const [isRenderingLocalImage, setIsRenderingLocalImage] = useState(false);
  const [funPost, setFunPost] = useState("");
  const [funPostError, setFunPostError] = useState("");
  const [aiImageStatus, setAiImageStatus] = useState<AiImageTaskStatus>("idle");
  const [aiImageProgress, setAiImageProgress] = useState(0);
  const [aiImageUrl, setAiImageUrl] = useState("");
  const [aiImageArtDirection, setAiImageArtDirection] = useState("");
  const [aiImageCaption, setAiImageCaption] = useState("");
  const [aiImageError, setAiImageError] = useState("");
  const [aiVideoStatus, setAiVideoStatus] = useState<AiVideoTaskStatus>("idle");
  const [aiVideoProgress, setAiVideoProgress] = useState(0);
  const [aiVideoTaskId, setAiVideoTaskId] = useState("");
  const [aiVideoUrl, setAiVideoUrl] = useState("");
  const [aiVideoFirstFrameUrl, setAiVideoFirstFrameUrl] = useState("");
  const [aiVideoCaption, setAiVideoCaption] = useState("");
  const [aiVideoSpokenLine, setAiVideoSpokenLine] = useState("");
  const [aiVideoError, setAiVideoError] = useState("");
  const [musicVideoStatus, setMusicVideoStatus] = useState<MusicVideoTaskStatus>("idle");
  const [musicVideoUrl, setMusicVideoUrl] = useState("");
  const [musicVideoBlob, setMusicVideoBlob] = useState<Blob | null>(null);
  const [musicVideoCaption, setMusicVideoCaption] = useState("");
  const [musicVideoError, setMusicVideoError] = useState("");
  const [musicVideoTrackLabel, setMusicVideoTrackLabel] = useState("");
  const [dialogueVoiceCast, setDialogueVoiceCast] = useState<DialogueVoiceCast>([]);
  const [confusedWordsCards, setConfusedWordsCards] = useState<ConfusedWordsCardPair[] | null>(null);
  const [carouselCards, setCarouselCards] = useState<VocabularyCard[]>([]);
  const [carouselImageUrls, setCarouselImageUrls] = useState<string[]>([]);
  const [carouselCaption, setCarouselCaption] = useState("");
  const [carouselError, setCarouselError] = useState("");
  const [isRenderingCarousel, setIsRenderingCarousel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const aiVideoStatusFailuresRef = useRef(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const posterExportRef = useRef<HTMLDivElement>(null);
  const musicCardExportRef = useRef<HTMLDivElement>(null);
  const musicPosterExportRef = useRef<HTMLDivElement>(null);
  const carouselSlideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const confusedWordsCardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const caption = isTextGenerator(generatorMode) ? funPost : isCarouselImageGenerator(generatorMode) ? carouselCaption : card ? createWordCaption(card) : "";
  const generatorOptions = GENERATOR_OPTIONS[studioMode];
  const posterTierPalette = card ? POSTER_TIER_PALETTES[card.tier] : null;
  const aiImagePending = aiImageStatus === "running";
  const musicVideoPending = musicVideoStatus === "creating-image" || musicVideoStatus === "rendering";
  const isMusicVideoMode = isMusicVideoGenerator(generatorMode);
  const isConfusedWordsVideoMode = isConfusedWordsVideoGenerator(generatorMode);
  const isDialogueVideoMode = isDialogueVideoGenerator(generatorMode);
  const isOriginalMascotLearningVideoMode = isOriginalMascotLearningVideoGenerator(generatorMode);
  const isBrowserVideoMode = isMusicVideoMode || isConfusedWordsVideoMode || isDialogueVideoMode || isOriginalMascotLearningVideoMode;
  const carouselSlideCount = isTierProgressionCarouselGenerator(generatorMode) ? 3 : 6;

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const response = await fetch("/api/twitter-automation/auth", { cache: "no-store" });
      const payload = await response.json() as { authenticated?: boolean };
      if (!cancelled) setAuthenticated(payload.authenticated === true);
    }

    void checkSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isCarouselImageGenerator(generatorMode) || carouselCards.length !== carouselSlideCount) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        setIsRenderingCarousel(true);
        setCarouselImageUrls([]);
        setCarouselError("");

        try {
          await document.fonts?.ready;
          const slides = carouselSlideRefs.current;
          if (slides.length !== carouselCards.length || slides.some((slide) => !slide)) throw new Error("carousel_render_unavailable");
          const rendered = await Promise.all(slides.map((slide) => toPng(slide!, { cacheBust: true, pixelRatio: 3, backgroundColor: "#16120f" })));
          if (!cancelled) setCarouselImageUrls(rendered);
        } catch {
          if (!cancelled) setCarouselError("The carousel images could not be rendered. Try again.");
        } finally {
          if (!cancelled) setIsRenderingCarousel(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [carouselCards, carouselSlideCount, generatorMode]);

  useEffect(() => {
    if (!card || (generatorMode !== "word-of-the-day" && generatorMode !== "word-of-the-day-poster")) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        const isPoster = generatorMode === "word-of-the-day-poster";
        const source = isPoster ? posterExportRef.current : exportRef.current;
        if (!source) return;
        setIsRenderingLocalImage(true);
        setLocalImageRenderError("");
        if (isPoster) setPosterImageUrl("");
        else setCardImageUrl("");

        try {
          await document.fonts?.ready;
          const dataUrl = await toPng(source, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: isPoster ? POSTER_TIER_PALETTES[card.tier].base : "#000000",
          });
          if (!cancelled) {
            if (isPoster) setPosterImageUrl(dataUrl);
            else setCardImageUrl(dataUrl);
          }
        } catch {
          if (!cancelled) setLocalImageRenderError("The image could not be rendered. Try again.");
        } finally {
          if (!cancelled) setIsRenderingLocalImage(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [card, generatorMode, nativeLanguage]);

  useEffect(() => {
    if (!aiVideoTaskId || (aiVideoStatus !== "queued" && aiVideoStatus !== "running")) return;

    let cancelled = false;
    const poll = async () => {
      const videoResponse = await fetch(`/api/twitter-automation/ai-video?taskId=${encodeURIComponent(aiVideoTaskId)}`, { cache: "no-store" });
      if (cancelled) return;
      if (videoResponse.status === 401) {
        setAuthenticated(false);
        return;
      }

      const videoPayload = await videoResponse.json().catch(() => null) as ({ status?: string; progress?: number; videoUrl?: string | null; errorMessage?: string | null } & SocialStudioFailurePayload) | null;
      if (!videoResponse.ok || !videoPayload?.status) {
        aiVideoStatusFailuresRef.current += 1;
        if (aiVideoStatusFailuresRef.current >= 3) {
          setAiVideoStatus("failed");
          setAiVideoError(formatSocialStudioFailure(videoResponse, videoPayload, "Avatar video status could not be checked."));
        }
        return;
      }

      aiVideoStatusFailuresRef.current = 0;
      setAiVideoProgress(Math.max(0, Math.min(100, videoPayload.progress ?? 0)));
      if (videoPayload.status === "failed") {
        setAiVideoStatus("failed");
        setAiVideoError(videoPayload.errorMessage || "The avatar video could not be generated. Try again.");
        return;
      }
      if (videoPayload.status === "finished" && videoPayload.videoUrl) {
        setAiVideoUrl(videoPayload.videoUrl);
        setAiVideoStatus("finished");
        return;
      }
      setAiVideoStatus(videoPayload.status === "running" ? "running" : "queued");
    };

    void poll();
    const interval = window.setInterval(() => { void poll(); }, 3500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [aiVideoStatus, aiVideoTaskId]);

  useEffect(() => {
    return () => {
      if (musicVideoUrl) URL.revokeObjectURL(musicVideoUrl);
    };
  }, [musicVideoUrl]);

  async function loadCard(nextLanguage: LanguageCode, nextTier: Tier, showLoading = true) {
    if (showLoading) setIsLoading(true);
    setCardImageUrl("");
    setPosterImageUrl("");
    setLocalImageRenderError("");
    try {
      const response = await fetch(`/api/twitter-automation/card?language=${nextLanguage}&tier=${nextTier}&type=word`);
      if (response.status === 401) {
        setAuthenticated(false);
        return null;
      }

      const payload = await response.json() as { card?: VocabularyCard };
      const nextCard = payload.card ?? null;
      setCard(nextCard);
      return nextCard;
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  async function loadFunPost(mode: TextGeneratorMode) {
    setIsLoading(true);
    setCard(null);
    setFunPostError("");
    try {
      const response = await fetch("/api/twitter-automation/fun-post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, language, nativeLanguage }),
      });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json().catch(() => null) as ({ post?: string } & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.post) {
        setFunPost("");
        setFunPostError(formatSocialStudioFailure(response, payload, "Text post generation failed."));
        return;
      }
      setFunPost(payload.post);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateVocabularyCarousel() {
    setIsLoading(true);
    setCard(null);
    setCarouselCards([]);
    setCarouselImageUrls([]);
    setCarouselCaption("");
    setCarouselError("");
    carouselSlideRefs.current = [];

    try {
      const responses = await Promise.all(randomCarouselTiers().map(async (randomTier) => {
        const response = await fetch(`/api/twitter-automation/card?language=${encodeURIComponent(language)}&tier=${randomTier}&type=word`);
        if (response.status === 401) {
          setAuthenticated(false);
          return null;
        }
        if (!response.ok) return null;
        const payload = await response.json() as { card?: VocabularyCard };
        return payload.card ?? null;
      }));
      const cards = responses.filter((candidate): candidate is VocabularyCard => candidate !== null);
      if (cards.length !== 6 || new Set(cards.map((candidate) => candidate.sourceKey)).size !== 6) {
        setCarouselError("Six different vocabulary cards could not be prepared. Try again.");
        return;
      }
      const tag = ENGLISH_LANGUAGE_NAMES[language].toLowerCase().replaceAll(" ", "");
      setCarouselCards(cards);
      setCarouselCaption(`Six ${ENGLISH_LANGUAGE_NAMES[language]} words to keep in your vocabulary today. Which one will you use first?\n\n#${tag} #languagelearning #vocabulary`);
    } catch {
      setCarouselError("The vocabulary carousel could not be created. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateTierProgressionCarousel() {
    const progressionTiers: Tier[] = ["A1", "B2", "C1"];
    setIsLoading(true);
    setCard(null);
    setCarouselCards([]);
    setCarouselImageUrls([]);
    setCarouselCaption("");
    setCarouselError("");
    carouselSlideRefs.current = [];

    try {
      const responses = await Promise.all(progressionTiers.map(async (progressionTier) => {
        const response = await fetch(`/api/twitter-automation/card?language=${encodeURIComponent(language)}&tier=${progressionTier}&type=word`);
        if (response.status === 401) {
          setAuthenticated(false);
          return null;
        }
        if (!response.ok) return null;
        const payload = await response.json() as { card?: VocabularyCard };
        return payload.card ?? null;
      }));
      const cards = responses.filter((candidate): candidate is VocabularyCard => candidate !== null);
      if (cards.length !== 3 || new Set(cards.map((candidate) => candidate.sourceKey)).size !== 3) {
        setCarouselError("The A1, B2, and C1 cards could not be prepared. Try again.");
        return;
      }
      const tag = ENGLISH_LANGUAGE_NAMES[language].toLowerCase().replaceAll(" ", "");
      setCarouselCards(cards);
      setCarouselCaption(`From A1 to C1: three ${ENGLISH_LANGUAGE_NAMES[language]} words for your next level.\n\n#${tag} #languagelearning #vocabulary`);
    } catch {
      setCarouselError("The A1 to C1 carousel could not be created. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateAiImage(mode: AiImageGeneratorMode) {
    setIsLoading(true);
    setCard(null);
    setAiImageStatus("running");
    setAiImageProgress(0);
    setAiImageUrl("");
    setAiImageArtDirection("");
    setAiImageCaption("");
    setAiImageError("");

    try {
      const response = await fetch("/api/twitter-automation/ai-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, language, nativeLanguage, tier }),
      });

      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json().catch(() => null) as ({ imageUrl?: string; artDirection?: string; caption?: string } & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.imageUrl) {
        setAiImageStatus("failed");
        setAiImageError(formatSocialStudioFailure(response, payload, "AI image generation failed."));
        return;
      }

      setAiImageUrl(payload.imageUrl);
      setAiImageArtDirection(payload.artDirection ?? "");
      setAiImageCaption(payload.caption ?? "");
      setAiImageProgress(100);
      setAiImageStatus("finished");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateAiVideo() {
    setIsLoading(true);
    setCard(null);
    setAiVideoStatus("preparing");
    setAiVideoProgress(0);
    setAiVideoTaskId("");
    setAiVideoUrl("");
    setAiVideoFirstFrameUrl("");
    setAiVideoCaption("");
    setAiVideoSpokenLine("");
    setAiVideoError("");
    setMusicVideoStatus("idle");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);
    setMusicVideoCaption("");
    setMusicVideoError("");
    setMusicVideoTrackLabel("");
    setDialogueVoiceCast([]);
    aiVideoStatusFailuresRef.current = 0;

    try {
      const response = await fetch("/api/twitter-automation/ai-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, nativeLanguage, tier }),
      });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json().catch(() => null) as ({ taskId?: string; firstFrameUrl?: string; caption?: string; spokenLine?: string } & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.taskId || !payload.firstFrameUrl) {
        setAiVideoStatus("failed");
        setAiVideoError(formatSocialStudioFailure(response, payload, "Avatar video generation failed."));
        return;
      }

      setAiVideoTaskId(payload.taskId);
      setAiVideoFirstFrameUrl(payload.firstFrameUrl);
      setAiVideoCaption(payload.caption ?? "");
      setAiVideoSpokenLine(payload.spokenLine ?? "");
      setAiVideoStatus("queued");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateMusicVideo(mode: MusicVideoGeneratorMode) {
    const sourceMode = getMusicVideoImageMode(mode);
    const musicTrack = SOCIAL_VIDEO_MUSIC_TRACKS[Math.floor(Math.random() * SOCIAL_VIDEO_MUSIC_TRACKS.length)];
    let audioContext: AudioContext | null = null;

    setIsLoading(true);
    setCard(null);
    setMusicVideoStatus("creating-image");
    setMusicVideoCaption("");
    setMusicVideoError("");
    setMusicVideoTrackLabel("");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);
    setDialogueVoiceCast([]);

    try {
      // This is intentionally created directly from the button interaction so browsers permit audio capture.
      audioContext = prepareMusicVideoAudio();
      let imageUrl = "";
      let nextCaption = "";

      if (isAiImageGenerator(sourceMode)) {
        const response = await fetch("/api/twitter-automation/ai-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: sourceMode, language, nativeLanguage, tier }),
        });

        if (response.status === 401) {
          setAuthenticated(false);
          return;
        }

        const payload = await response.json().catch(() => null) as ({ imageUrl?: string; caption?: string } & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.imageUrl) {
          setMusicVideoStatus("failed");
          setMusicVideoError(formatSocialStudioFailure(response, payload, "Music video source-image generation failed."));
          return;
        }

        imageUrl = payload.imageUrl;
        nextCaption = payload.caption ?? "";
      } else {
        const nextCard = await loadCard(language, tier, false);
        if (!nextCard) {
          setMusicVideoStatus("failed");
          setMusicVideoError("A word card could not be loaded for this video.");
          return;
        }

        await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
        const source = sourceMode === "word-of-the-day" ? musicCardExportRef.current : musicPosterExportRef.current;
        if (!source) {
          setMusicVideoStatus("failed");
          setMusicVideoError("The card visual could not be prepared. Try again.");
          return;
        }

        const loadedImages = Promise.all(Array.from(source.querySelectorAll("img")).map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }));
        await Promise.race([loadedImages, new Promise<void>((resolve) => window.setTimeout(resolve, 5_000))]);
        imageUrl = await toPng(source, {
          cacheBust: true,
          pixelRatio: 1,
          backgroundColor: sourceMode === "word-of-the-day" ? "#000000" : POSTER_TIER_PALETTES[nextCard.tier].base,
        });
        nextCaption = createWordCaption(nextCard);
      }

      setMusicVideoStatus("rendering");
      const videoBlob = await renderMusicVideo({ audioContext, imageUrl, musicUrl: musicTrack.url });
      audioContext = null;
      setMusicVideoUrl(URL.createObjectURL(videoBlob));
      setMusicVideoBlob(videoBlob);
      setMusicVideoCaption(nextCaption);
      setMusicVideoTrackLabel(musicTrack.label);
      setMusicVideoStatus("finished");
    } catch (error) {
      setMusicVideoStatus("failed");
      setMusicVideoError(formatSocialStudioClientFailure("Music video browser renderer", error, "This browser could not render the music video."));
    } finally {
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      setIsLoading(false);
    }
  }

  async function renderConfusedWordsCardFaces(cards: readonly ConfusedWordsCardPair[]) {
    confusedWordsCardRefs.current = [];
    setConfusedWordsCards([...cards]);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    await document.fonts?.ready;

    const faces = confusedWordsCardRefs.current;
    if (faces.length !== cards.length * 2 || faces.some((face) => !face)) throw new Error("confused_words_card_render_unavailable");
    const loadedImages = Promise.all(faces.flatMap((face) => Array.from(face!.querySelectorAll("img")).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    })));
    await Promise.race([loadedImages, new Promise<void>((resolve) => window.setTimeout(resolve, 5_000))]);
    return await Promise.all(faces.map((face) => toPng(face!, { cacheBust: true, pixelRatio: 1, backgroundColor: "#fffdf9" })));
  }

  async function generateConfusedWordsVideo() {
    let audioContext: AudioContext | null = null;

    setIsLoading(true);
    setCard(null);
    setMusicVideoStatus("creating-image");
    setMusicVideoCaption("");
    setMusicVideoError("");
    setMusicVideoTrackLabel("");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);

    try {
      // Create this during the button interaction so Chrome permits audio capture later.
      audioContext = prepareMusicVideoAudio();
      const response = await fetch("/api/twitter-automation/confused-words-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, nativeLanguage, tier }),
      });

      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json().catch(() => null) as ({
        caption?: string;
        phases?: Array<{ first?: VocabularyCard; second?: VocabularyCard }>;
        scenes?: ConfusedWordsVideoScene[];
      } & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.phases || payload.phases.length !== 3 || payload.phases.some((phase) => !phase.first || !phase.second) || !payload.scenes) {
        setMusicVideoStatus("failed");
        setMusicVideoError(formatSocialStudioFailure(response, payload, "Confused Words video generation failed."));
        return;
      }

      setMusicVideoStatus("rendering");
      const confusedWordsCards: ConfusedWordsCardPair[] = payload.phases.map((phase) => ({ first: phase.first!, second: phase.second! }));
      const cardImageUrls = await renderConfusedWordsCardFaces(confusedWordsCards);
      const videoBlob = await renderConfusedWordsVideo({
        audioContext,
        cardImageUrls,
        phases: confusedWordsCards,
        scenes: payload.scenes,
      });
      audioContext = null;
      setMusicVideoUrl(URL.createObjectURL(videoBlob));
      setMusicVideoBlob(videoBlob);
      setMusicVideoCaption(payload.caption ?? "");
      setMusicVideoTrackLabel("Confused words explainer");
      setMusicVideoStatus("finished");
    } catch (error) {
      setMusicVideoStatus("failed");
      setMusicVideoError(formatSocialStudioClientFailure("Confused Words browser renderer", error, "This browser could not render the Confused Words video."));
    } finally {
      setConfusedWordsCards(null);
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      setIsLoading(false);
    }
  }

  async function generateDialogueVideo(mode: DialogueVideoGeneratorMode) {
    let audioContext: AudioContext | null = null;

    setIsLoading(true);
    setCard(null);
    setMusicVideoStatus("creating-image");
    setMusicVideoCaption("");
    setMusicVideoError("");
    setMusicVideoTrackLabel("");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);
    setDialogueVoiceCast([]);

    try {
      // Create this during the button interaction so Chrome permits audio capture later.
      audioContext = prepareMusicVideoAudio();
      const response = await fetch("/api/twitter-automation/dialogue-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, language, nativeLanguage }),
      });

      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json().catch(() => null) as ({
        caption?: string;
        backgroundVideoUrl?: string;
        firstCharacter?: string;
        secondCharacter?: string;
        voices?: Record<string, string>;
        scenes?: DialogueVideoScene[];
      } & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.backgroundVideoUrl || !payload.firstCharacter || !payload.secondCharacter || !payload.scenes?.length) {
        setMusicVideoStatus("failed");
        setMusicVideoError(formatSocialStudioFailure(response, payload, "Dialogue video generation failed."));
        return;
      }

      setMusicVideoStatus("rendering");
      const videoBlob = await renderDialogueVideo({
        audioContext,
        backgroundVideoUrl: payload.backgroundVideoUrl,
        firstCharacter: payload.firstCharacter,
        secondCharacter: payload.secondCharacter,
        scenes: payload.scenes,
      });
      audioContext = null;
      setMusicVideoUrl(URL.createObjectURL(videoBlob));
      setMusicVideoBlob(videoBlob);
      setMusicVideoCaption(payload.caption ?? "");
      setMusicVideoTrackLabel(mode === "marketing-dialogue-video" ? "FoxiesDeck dialogue" : "Everyday dialogue");
      setDialogueVoiceCast(Object.entries(payload.voices ?? {}).map(([mascot, voice]) => ({ mascot, voice })));
      setMusicVideoStatus("finished");
    } catch (error) {
      setMusicVideoStatus("failed");
      setMusicVideoError(formatSocialStudioClientFailure("Dialogue browser renderer", error, "This browser could not render the dialogue video."));
    } finally {
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      setIsLoading(false);
    }
  }

  async function generateOriginalMascotLearningVideo(mode: OriginalMascotLearningVideoGeneratorMode) {
    let audioContext: AudioContext | null = null;

    setIsLoading(true);
    setCard(null);
    setMusicVideoStatus("creating-image");
    setMusicVideoCaption("");
    setMusicVideoError("");
    setMusicVideoTrackLabel("");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);

    try {
      // Construct the context in the button gesture so browser audio capture remains allowed.
      audioContext = prepareMusicVideoAudio();
      const response = await fetch("/api/twitter-automation/original-mascot-learning-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, language, nativeLanguage }),
      });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json().catch(() => null) as (OriginalMascotLearningVideoPayload & SocialStudioFailurePayload) | null;
      if (!response.ok || !payload?.caption || !payload.scenes?.length || payload.mode !== mode) {
        setMusicVideoStatus("failed");
        setMusicVideoError(formatSocialStudioFailure(response, payload, "Learning video generation failed."));
        return;
      }

      setMusicVideoStatus("rendering");
      const videoBlob = await renderOriginalMascotLearningVideo({ audioContext, scenes: payload.scenes });
      audioContext = null;
      setMusicVideoUrl(URL.createObjectURL(videoBlob));
      setMusicVideoBlob(videoBlob);
      setMusicVideoCaption(payload.caption);
      setMusicVideoTrackLabel(mode === "tier-progression-video" ? "A1 to C1 progression" : mode === "vocabulary-quiz-video" ? "Vocabulary quiz" : "Sentence check");
      setMusicVideoStatus("finished");
    } catch (error) {
      setMusicVideoStatus("failed");
      setMusicVideoError(formatSocialStudioClientFailure("Learning video browser renderer", error, "This browser could not render the learning video."));
    } finally {
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      setIsLoading(false);
    }
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const response = await fetch("/api/twitter-automation/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setAuthError("Name or password is incorrect.");
        return;
      }

      setPassword("");
      setAuthenticated(true);
    } finally {
      setIsAuthenticating(false);
    }
  }

  function selectStudioMode(nextMode: StudioMode) {
    setStudioMode(nextMode);
    setGeneratorMode(GENERATOR_OPTIONS[nextMode][0].value);
    setCard(null);
    setFunPost("");
    setAiImageStatus("idle");
    setAiImageProgress(0);
    setAiImageUrl("");
    setAiImageArtDirection("");
    setAiImageCaption("");
    setAiImageError("");
    setAiVideoStatus("idle");
    setAiVideoProgress(0);
    setAiVideoTaskId("");
    setAiVideoUrl("");
    setAiVideoFirstFrameUrl("");
    setAiVideoCaption("");
    setAiVideoSpokenLine("");
    setAiVideoError("");
    setMusicVideoStatus("idle");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);
    setMusicVideoCaption("");
    setMusicVideoError("");
    setMusicVideoTrackLabel("");
    setCarouselCards([]);
    setCarouselImageUrls([]);
    setCarouselCaption("");
    setCarouselError("");
    carouselSlideRefs.current = [];
  }

  function selectLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
  }

  function selectNativeLanguage(nextLanguage: LanguageCode) {
    setNativeLanguage(nextLanguage);
  }

  function selectTier(nextTier: Tier) {
    setTier(nextTier);
  }

  function selectGeneratorMode(nextMode: GeneratorMode) {
    setGeneratorMode(nextMode);
    setCard(null);
    setFunPost("");
    setAiImageStatus("idle");
    setAiImageProgress(0);
    setAiImageUrl("");
    setAiImageArtDirection("");
    setAiImageCaption("");
    setAiImageError("");
    setAiVideoStatus("idle");
    setAiVideoProgress(0);
    setAiVideoTaskId("");
    setAiVideoUrl("");
    setAiVideoFirstFrameUrl("");
    setAiVideoCaption("");
    setAiVideoSpokenLine("");
    setAiVideoError("");
    setMusicVideoStatus("idle");
    setMusicVideoUrl("");
    setMusicVideoBlob(null);
    setMusicVideoCaption("");
    setMusicVideoError("");
    setCarouselCards([]);
    setCarouselImageUrls([]);
    setCarouselCaption("");
    setCarouselError("");
    carouselSlideRefs.current = [];
  }

  function toggleGeneratorHighlight(mode: GeneratorMode) {
    setHighlightedGeneratorModes((current) => {
      const next = new Set(current);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  }

  function generateContent() {
    if (isTextGenerator(generatorMode)) {
      void loadFunPost(generatorMode);
      return;
    }

    if (isAiImageGenerator(generatorMode)) {
      void generateAiImage(generatorMode);
      return;
    }

    if (isVocabularyCarouselGenerator(generatorMode)) {
      void generateVocabularyCarousel();
      return;
    }

    if (isTierProgressionCarouselGenerator(generatorMode)) {
      void generateTierProgressionCarousel();
      return;
    }

    if (isMusicVideoGenerator(generatorMode)) {
      void generateMusicVideo(generatorMode);
      return;
    }

    if (isConfusedWordsVideoGenerator(generatorMode)) {
      void generateConfusedWordsVideo();
      return;
    }

    if (isDialogueVideoGenerator(generatorMode)) {
      void generateDialogueVideo(generatorMode);
      return;
    }

    if (isOriginalMascotLearningVideoGenerator(generatorMode)) {
      void generateOriginalMascotLearningVideo(generatorMode);
      return;
    }

    if (isAiVideoGenerator(generatorMode)) {
      void generateAiVideo();
      return;
    }

    void loadCard(language, tier);
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(caption);
  }

  async function createCarouselAssets(): Promise<SocialPublishImageAsset[] | undefined> {
    if (carouselImageUrls.length !== carouselCards.length) return undefined;
    return carouselImageUrls.map((dataUrl) => ({ dataUrl, mimeType: "image/png" as const }));
  }

  async function downloadCarousel() {
    setIsExporting(true);
    try {
      const assets = await createCarouselAssets();
      if (!assets) return;
      assets.forEach((asset, index) => {
        const link = document.createElement("a");
        link.download = `foxiesdeck-vocabulary-${index + 1}.png`;
        link.href = asset.dataUrl;
        link.click();
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function createAiImageAsset(): Promise<SocialPublishAsset | undefined> {
    if (!aiImageUrl) return undefined;
    if (aiImageUrl.startsWith("data:image/png;base64,")) return { dataUrl: aiImageUrl, mimeType: "image/png" };
    const response = await fetch(aiImageUrl);
    if (!response.ok) throw new Error("image_unavailable");
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, mimeType: blob.type === "image/jpeg" ? "image/jpeg" : blob.type === "image/webp" ? "image/webp" : "image/png" };
  }

  async function downloadImage() {
    if (!cardImageUrl || !card) return;

    setIsExporting(true);
    try {
      const link = document.createElement("a");
      link.download = `foxiesdeck-${card.language}-${card.tier}-${card.term.toLowerCase().replaceAll(/[^a-z0-9]+/giu, "-")}.png`;
      link.href = cardImageUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadPoster() {
    if (!posterImageUrl || !card) return;

    setIsExporting(true);
    try {
      const link = document.createElement("a");
      link.download = `foxiesdeck-word-of-the-day-${card.language}-${card.tier}-${card.term.toLowerCase().replaceAll(/[^a-z0-9]+/giu, "-")}.png`;
      link.href = posterImageUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  }

  async function downloadAiImage() {
    if (!aiImageUrl) return;

    setIsExporting(true);
    try {
      const response = await fetch(aiImageUrl);
      if (!response.ok) throw new Error("download_failed");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "foxiesdeck-ai-image.png";
      link.href = objectUrl;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(aiImageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsExporting(false);
    }
  }

  async function copyAiImageCaption() {
    await navigator.clipboard.writeText(aiImageCaption);
  }

  async function copyAiVideoCaption() {
    await navigator.clipboard.writeText(aiVideoCaption);
  }

  async function copyMusicVideoCaption() {
    await navigator.clipboard.writeText(musicVideoCaption);
  }

  async function downloadAiVideo() {
    if (!aiVideoUrl) return;

    setIsExporting(true);
    try {
      const response = await fetch(aiVideoUrl);
      if (!response.ok) throw new Error("download_failed");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "foxiesdeck-word-of-the-day.mp4";
      link.href = objectUrl;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(aiVideoUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsExporting(false);
    }
  }

  function downloadMusicVideo() {
    if (!musicVideoUrl) return;

    const link = document.createElement("a");
    link.download = isConfusedWordsVideoMode ? "foxiesdeck-confused-words.webm" : isDialogueVideoMode || isOriginalMascotLearningVideoMode ? `foxiesdeck-${generatorMode}.webm` : "foxiesdeck-music-video-30s.webm";
    link.href = musicVideoUrl;
    link.click();
  }

  async function createMusicVideoAsset(): Promise<SocialPublishAsset | undefined> {
    if (!musicVideoBlob) return undefined;
    const staged = await stageBrowserVideo(musicVideoBlob, "manual-video");
    return { sourceUrl: staged.sourceUrl, mimeType: staged.mimeType };
  }

  if (authenticated !== true) {
    return (
      <section className="content-automation-shell relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden bg-[#12100e] px-4 py-10 text-[#f9f2e9]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(203,255,66,0.22),transparent_28rem),radial-gradient(circle_at_90%_90%,rgba(150,218,36,0.16),transparent_24rem)]" />
        <form className="relative w-full max-w-sm rounded-xl border border-white/15 bg-[#1b1714] p-6 shadow-sm" onSubmit={submitCredentials}>
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#f5ac27] text-[#251106]">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold">Social content studio</h1>
          <p className="mt-2 text-sm leading-6 text-[#d7c9bc]">Private workspace for FoxiesDeck social posts, card images, and future video formats.</p>

          <label className="mt-7 block text-sm font-semibold" htmlFor="social-studio-name">Admin name</label>
          <input
            autoComplete="username"
            className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#8d8177] focus:border-[#f5ac27]"
            id="social-studio-name"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          <label className="mt-4 block text-sm font-semibold" htmlFor="social-studio-password">Password</label>
          <input
            autoComplete="current-password"
            className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#8d8177] focus:border-[#f5ac27]"
            id="social-studio-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {authError ? <p className="mt-3 text-sm text-[#ffae9f]" role="alert">{authError}</p> : null}
          <Button className="mt-6 h-11 w-full bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isAuthenticating || authenticated === null} type="submit">
            {isAuthenticating ? "Opening studio..." : "Open studio"}
          </Button>
        </form>
      </section>
    );
  }

  if (view === "automations") {
    return <AutomationTable onBack={() => router.push("/content-automation")} onOpenSocialMedias={() => router.push("/content-automation/social-medias")} />;
  }

  if (view === "social-medias") {
    return <SocialMediasTable onBack={() => router.push("/content-automation")} onOpenAutomations={() => router.push("/content-automation/automations")} />;
  }

  if (view === "scheduled-posts") {
    return <ScheduledPostsTable onBack={() => router.push("/content-automation")} />;
  }

  return (
    <section className="content-automation-shell min-h-[calc(100dvh-4rem)] bg-[#12100e] px-4 py-6 text-[#f9f2e9] sm:px-6 sm:py-10">
      {confusedWordsCards ? <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 flex gap-8">
        {confusedWordsCards.flatMap((pair) => [pair.first, pair.second]).map((confusedCard, index) => (
          <div className="w-[430px] [&_[data-card-example-preview]]:origin-center [&_[data-card-example-preview]]:scale-[1.42]" key={confusedCard.sourceKey} ref={(element) => { confusedWordsCardRefs.current[index] = element; }}>
            <VocabularyCardView card={confusedCard} frontFit frontContentScale={1.7} showActions={false} staticFace translationLocale={nativeLanguage} />
          </div>
        ))}
      </div> : null}
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#ffb355]">FoxiesDeck developer tool</p>
              <span className="text-xs font-medium text-[#9c8f84]">v{SOCIAL_CONTENT_STUDIO_VERSION}</span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Social content studio</h1>
            <p className="mt-2 text-sm leading-6 text-[#cdbfb3]">Choose a format first, then create an export-ready post for the right channel.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap"><Button className="h-11 border-transparent bg-[#c7f05d] text-black hover:bg-[#d6ff73]" onClick={() => router.push("/content-automation/social-medias")} type="button"><Database className="size-4" aria-hidden="true" />Social medias</Button><Button className="h-11 border-transparent bg-[#c7f05d] text-black hover:bg-[#d6ff73]" onClick={() => router.push("/content-automation/automations")} type="button"><ListChecks className="size-4" aria-hidden="true" />Automation table</Button><Button className="h-11 border-transparent bg-[#c7f05d] text-black hover:bg-[#d6ff73]" onClick={() => router.push("/content-automation/scheduled-posts")} type="button"><CalendarClock className="size-4" aria-hidden="true" />Scheduled Posts</Button></div>
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {STUDIO_MODES.map((option) => {
            const Icon = option.icon;
            const selected = studioMode === option.value;
            return (
              <button
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                  selected ? "border-[#f5ac27] bg-[#f5ac27] text-black" : "border-white/10 bg-[#1b1714] hover:bg-[#231d19]",
                )}
                key={option.value}
                onClick={() => selectStudioMode(option.value)}
                type="button"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center", selected ? "text-black" : "text-[#f5d6a7]")}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base font-semibold">{option.label}</span>
                  <span className={cn("mt-1 block text-sm leading-5", selected ? "text-black/75" : "text-[#cdbfb3]")}>{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {studioMode === "video" ? (
          <div className="mt-7 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit rounded-xl border border-white/10 bg-[#1b1714] p-4 sm:p-5">
              <p className="text-sm font-semibold text-[#ffb355]">Video generators</p>
              <div className="mt-3 space-y-2">
                {generatorOptions.map((option) => <GeneratorModeOption highlighted={highlightedGeneratorModes.has(option.value)} key={option.value} onSelect={() => selectGeneratorMode(option.value)} onToggleHighlight={() => toggleGeneratorHighlight(option.value)} option={option} selected={generatorMode === option.value} />)}
              </div>

              <label className="mt-6 block text-sm font-semibold" htmlFor="social-studio-video-language">Learning language</label>
              <select className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none focus:border-[#f5ac27]" id="social-studio-video-language" onChange={(event) => selectLanguage(event.target.value as LanguageCode)} value={language}>
                {LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{ENGLISH_LANGUAGE_NAMES[item.code]}</option>)}
              </select>
              <label className="mt-5 block text-sm font-semibold" htmlFor="social-studio-video-native-language">Native language</label>
              <select className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none focus:border-[#f5ac27]" id="social-studio-video-native-language" onChange={(event) => selectNativeLanguage(event.target.value as LanguageCode)} value={nativeLanguage}>
                {LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{ENGLISH_LANGUAGE_NAMES[item.code]}</option>)}
              </select>
              <p className="mt-5 text-sm font-semibold">Level</p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {TIERS.map((item) => <Button className={tier === item ? "bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" : "border-white/15 bg-[#100d0c] text-[#f9f2e9] hover:bg-[#231d19]"} key={item} onClick={() => selectTier(item)} size="sm" type="button">{item}</Button>)}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#cdbfb3]">{isMusicVideoMode ? `Uses the selected image format as the source, then renders a ${MUSIC_VIDEO_DURATION_SECONDS}-second square video with a randomly selected licensed social-video track.` : isConfusedWordsVideoMode ? "Creates a 9:16, three-phase explainer with six easily confused words, native-language differences, and synchronized mascot voices." : isOriginalMascotLearningVideoMode ? originalMascotLearningVideoDescription(generatorMode) : generatorMode === "marketing-dialogue-video" ? "A site-supported learning language is chosen at random. Two mascot variations discuss FoxiesDeck in the selected native language." : generatorMode === "learning-dialogue-video" ? "Two mascot variations have an everyday conversation in the learning language. Native-language subtitles appear underneath." : "Creates a vertical avatar video. The mascot explains the word in the selected native language with synchronized speech."}</p>
              <Button className="mt-6 h-11 w-full bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isLoading || musicVideoPending || aiVideoStatus === "preparing" || aiVideoStatus === "queued" || aiVideoStatus === "running"} onClick={generateContent} type="button">
                <RefreshCw className={cn("size-4", (isLoading || musicVideoPending || aiVideoStatus === "preparing" || aiVideoStatus === "queued" || aiVideoStatus === "running") && "animate-spin")} aria-hidden="true" />
                {isMusicVideoMode ? musicVideoStatus === "creating-image" ? "Creating the source image..." : musicVideoStatus === "rendering" ? `Rendering ${MUSIC_VIDEO_DURATION_SECONDS}-second music video...` : "Generate music video" : isConfusedWordsVideoMode ? musicVideoStatus === "creating-image" ? "Writing script and preparing voices..." : musicVideoStatus === "rendering" ? "Rendering confused-words video..." : "Generate confused-words video" : isOriginalMascotLearningVideoMode ? musicVideoStatus === "creating-image" ? "Writing plan and preparing voices..." : musicVideoStatus === "rendering" ? "Rendering learning video..." : `Generate ${originalMascotLearningVideoLabel(generatorMode).toLocaleLowerCase()} video` : isDialogueVideoMode ? musicVideoStatus === "creating-image" ? "Writing dialogue and preparing voices..." : musicVideoStatus === "rendering" ? "Rendering dialogue video..." : "Generate dialogue video" : aiVideoStatus === "preparing" ? "Creating first frame and native voice..." : aiVideoStatus === "queued" || aiVideoStatus === "running" ? `Rendering lip-synced video, ${aiVideoProgress}%` : "Generate Word of the Day video"}
              </Button>
            </aside>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1b1714]">
              {isBrowserVideoMode ? (musicVideoUrl ? <>
                <video className={cn("max-h-[70dvh] w-full bg-[#100d0c] object-contain", isConfusedWordsVideoMode || isDialogueVideoMode || isOriginalMascotLearningVideoMode ? "aspect-[9/16]" : "aspect-square")} controls playsInline src={musicVideoUrl} />
                <div className="border-t border-white/15 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold text-[#ffb355]">Generated caption</p><p className="mt-1 text-xs text-[#cdbfb3]">{isConfusedWordsVideoMode ? "Eight spoken scenes. Exported as WebM." : isOriginalMascotLearningVideoMode ? "Original mascot, AI voice, subtitles, and interactive learning sequence. Exported as WebM." : isDialogueVideoMode ? "Two speakers with animated entrances and subtitles. Exported as WebM." : `Soundtrack: ${musicVideoTrackLabel}. Exported as WebM.`}</p>{isDialogueVideoMode && dialogueVoiceCast.length ? <p className="mt-2 text-xs text-[#cdbfb3]">Voice cast: {dialogueVoiceCast.map(({ mascot, voice }, index) => <span key={mascot}>{index ? " · " : ""}{mascot.replace(/\.png$/iu, "")} — {voice}</span>)}</p> : null}</div>
                    <div className="flex flex-wrap items-center gap-2"><Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={copyMusicVideoCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button><Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" onClick={downloadMusicVideo} size="sm" type="button"><Download className="size-4" />Download video</Button><SocialPublishActions caption={musicVideoCaption} getAsset={createMusicVideoAsset} /></div>
                  </div>
                  <textarea className="mt-3 min-h-28 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-3 text-sm leading-6 text-white outline-none" readOnly value={musicVideoCaption} />
                </div>
              </> : <div className="grid min-h-[36rem] place-items-center p-6 text-center">
                <div>
                  {musicVideoPending ? <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" /> : <Video className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />}
                  <h2 className="mt-4 font-display text-2xl font-semibold">{isConfusedWordsVideoMode ? musicVideoStatus === "creating-image" ? "Writing the script and preparing voices" : musicVideoStatus === "rendering" ? "Rendering the vertical explainer" : musicVideoStatus === "failed" ? "Confused-words video generation failed" : "Create a confused-words video" : isOriginalMascotLearningVideoMode ? musicVideoStatus === "creating-image" ? "Writing the learning plan and preparing voices" : musicVideoStatus === "rendering" ? "Rendering the Original mascot video" : musicVideoStatus === "failed" ? "Learning video generation failed" : `Create a ${originalMascotLearningVideoLabel(generatorMode).toLocaleLowerCase()} video` : isDialogueVideoMode ? musicVideoStatus === "creating-image" ? "Writing dialogue and preparing voices" : musicVideoStatus === "rendering" ? "Rendering the vertical dialogue" : musicVideoStatus === "failed" ? "Dialogue video generation failed" : generatorMode === "marketing-dialogue-video" ? "Create a FoxiesDeck dialogue" : "Create an everyday dialogue" : musicVideoStatus === "creating-image" ? "Creating the image source" : musicVideoStatus === "rendering" ? "Rendering a 30-second music video" : musicVideoStatus === "failed" ? "Music video generation failed" : "Create a music video"}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#cdbfb3]">{musicVideoError || (isConfusedWordsVideoMode ? musicVideoStatus === "idle" ? "Choose a learning and native language. The studio selects six commonly confused words for three phases, then renders 24 spoken scenes in the browser." : "The mascots and TTS scenes are being composed into a 9:16 video in the browser." : isOriginalMascotLearningVideoMode ? musicVideoStatus === "idle" ? "Original mascot rises smoothly into a dark 9:16 scene and explains the learning activity with AI voice." : "The learning plan, spoken scenes, and animation are being composed into a 9:16 video in the browser." : isDialogueVideoMode ? musicVideoStatus === "idle" ? "Each turn rises smoothly from the bottom of the frame, while its subtitle remains at the top." : "The dialogue, subtitles, and two mascot variations are being composed into a 9:16 video in the browser." : musicVideoStatus === "idle" ? "Choose any image mode. Its visual keeps its original ratio and resolution, then receives a licensed social-video soundtrack." : "The video preserves the source image exactly while the soundtrack is rendered in the browser.")}</p>
                </div>
              </div>) : (aiVideoUrl ? <>
                <video className="aspect-[9/16] max-h-[70dvh] w-full bg-[#100d0c] object-contain" controls playsInline src={aiVideoUrl} />
                <div className="border-t border-white/15 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold text-[#ffb355]">Generated caption</p><p className="mt-1 text-xs text-[#cdbfb3]">Native-language mascot line: {aiVideoSpokenLine}</p></div>
                    <div className="flex flex-wrap items-center gap-2"><Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={copyAiVideoCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button><Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isExporting} onClick={downloadAiVideo} size="sm" type="button"><Download className="size-4" />{isExporting ? "Preparing video" : "Download video"}</Button><SocialPublishActions caption={aiVideoCaption} getAsset={async () => aiVideoUrl ? { sourceUrl: aiVideoUrl, mimeType: "video/mp4" } : undefined} /></div>
                  </div>
                  <textarea className="mt-3 min-h-28 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-3 text-sm leading-6 text-white outline-none" readOnly value={aiVideoCaption} />
                </div>
              </> : <div className="grid min-h-[36rem] place-items-center p-6 text-center">
                <div>
                  {aiVideoStatus === "preparing" || aiVideoStatus === "queued" || aiVideoStatus === "running" ? <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" /> : <Video className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />}
                  {aiVideoFirstFrameUrl ? <>
                    {/* The authenticated route returns the transient first frame as a data URL. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Generated Word of the Day first frame" className="mx-auto mt-5 aspect-[9/16] max-h-[22rem] rounded-lg object-cover" src={aiVideoFirstFrameUrl} />
                  </> : null}
                  <h2 className="mt-4 font-display text-2xl font-semibold">{aiVideoStatus === "idle" ? "Create a Word of the Day video" : aiVideoStatus === "preparing" ? "GPT Image is creating the avatar frame" : aiVideoStatus === "failed" ? "Video generation failed" : "Kling Avatar is syncing the mascot to its voice"}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#cdbfb3]">{aiVideoError || (aiVideoStatus === "idle" ? "Kling Avatar turns the mascot into a native-language word explainer with lip sync." : "The card stays readable above the mascot while its spoken explanation is synchronized to the animation.")}</p>
                  {aiVideoStatus === "queued" || aiVideoStatus === "running" ? <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#f5ac27] transition-[width] duration-500" style={{ width: `${Math.max(4, aiVideoProgress)}%` }} /></div> : null}
                </div>
              </div>)}
            </div>
            {isMusicVideoGenerator(generatorMode) && card ? <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0 z-[-1]">
              {getMusicVideoImageMode(generatorMode) === "word-of-the-day" ? <div ref={musicCardExportRef} className="social-card-export w-[1080px] bg-black px-12 py-20">
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
              </div> : <div ref={musicPosterExportRef} className="relative h-[810px] w-[1080px] overflow-hidden px-16 py-14 text-white" style={{ backgroundColor: posterTierPalette?.base }}>
                <div className="absolute inset-0" style={{ background: `linear-gradient(142deg, ${posterTierPalette?.base ?? "#059669"} 0%, ${posterTierPalette?.deep ?? "#064e3b"} 100%)` }} />
                <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ backgroundColor: posterTierPalette?.deep }} />
                <div className="absolute inset-10 border" style={{ borderColor: `${posterTierPalette?.accent ?? "#a7f3d0"}a6` }} />
                <div className="absolute left-16 right-16 top-[34%] h-px" style={{ backgroundColor: `${posterTierPalette?.accent ?? "#a7f3d0"}8c` }} />
                <style>{`
                  .social-video-poster-front [data-card-face] > div,
                  .social-video-poster-back [data-card-face] > div,
                  .social-video-poster-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
                  .social-video-poster-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
                  .social-video-poster-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
                `}</style>
                <div className="relative z-10">
                  <div className="relative h-12 w-56 overflow-hidden"><Image alt="" className="object-[50%_48%] object-cover" fill sizes="14rem" src="/splash.png" unoptimized /></div>
                  <h2 className="mt-2 max-w-md font-display text-5xl font-semibold leading-[0.92]">{ENGLISH_LANGUAGE_NAMES[card.language].toUpperCase()} WORD OF THE DAY</h2>
                </div>
                <div className="pointer-events-none absolute bottom-10 right-14 z-0 w-40 rotate-6"><Image alt="" className="h-auto w-full object-contain" height={512} src="/mascots/mascot16.webp" unoptimized width={512} /></div>
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-max -translate-x-1/2 -translate-y-1/2 items-center gap-20">
                  <div className="social-video-poster-front w-[300px]"><VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} /></div>
                  <div className="social-video-poster-back w-[300px]"><VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} /></div>
                </div>
                <p className="absolute bottom-14 left-16 z-10 max-w-[66%] text-xl font-semibold leading-8">{card.examples[0]?.sentence ?? card.example}</p>
              </div>}
            </div> : null}
          </div>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit rounded-xl border border-white/10 bg-[#1b1714] p-4 sm:p-5">
              <p className="text-sm font-semibold text-[#ffb355]">{studioMode === "text" ? "Text generators" : "Image generators"}</p>
              <div className="mt-3 space-y-2">
                {generatorOptions.map((option) => <GeneratorModeOption highlighted={highlightedGeneratorModes.has(option.value)} key={option.value} onSelect={() => selectGeneratorMode(option.value)} onToggleHighlight={() => toggleGeneratorHighlight(option.value)} option={option} selected={generatorMode === option.value} />)}
              </div>

              <>
                <label className="mt-6 block text-sm font-semibold" htmlFor="social-studio-language">Learning language</label>
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none focus:border-[#f5ac27]"
                  id="social-studio-language"
                  onChange={(event) => selectLanguage(event.target.value as LanguageCode)}
                  value={language}
                >
                  {LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{ENGLISH_LANGUAGE_NAMES[item.code]}</option>)}
                </select>
                <label className="mt-5 block text-sm font-semibold" htmlFor="social-studio-native-language">Native language</label>
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none focus:border-[#f5ac27]"
                  id="social-studio-native-language"
                  onChange={(event) => selectNativeLanguage(event.target.value as LanguageCode)}
                  value={nativeLanguage}
                >
                  {LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{ENGLISH_LANGUAGE_NAMES[item.code]}</option>)}
                </select>
                {isCarouselImageGenerator(generatorMode) ? <p className="mt-5 text-xs leading-5 text-[#cdbfb3]">{isTierProgressionCarouselGenerator(generatorMode) ? "Every run creates one A1, one B2, and one C1 card. The selected level is intentionally ignored." : "Every run uses six different cards from random levels. The selected level is intentionally ignored."}</p> : isCardGenerator(generatorMode) || isAiImageGenerator(generatorMode) ? <>{!isAiImageGenerator(generatorMode) || aiImageUsesTier(generatorMode) ? <>
                  <p className="mt-5 text-sm font-semibold">Level</p>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {TIERS.map((item) => (
                      <Button className={tier === item ? "bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" : "border-white/15 bg-[#100d0c] text-[#f9f2e9] hover:bg-[#231d19]"} key={item} onClick={() => selectTier(item)} size="sm" type="button">
                        {item}
                      </Button>
                    ))}
                  </div>
                </> : <p className="mt-5 text-xs leading-5 text-[#cdbfb3]">{generatorMode === "ai-vocabulary-progression" ? "Word range: A1-A2 to B2-C1" : "The comparison is selected from the two chosen languages."}</p>}</> : <p className="mt-5 text-xs leading-5 text-[#cdbfb3]">Posts are written in the native language, with examples and vocabulary in the selected learning language.</p>}
                {isAiImageGenerator(generatorMode) ? <p className="mt-4 text-xs leading-5 text-[#cdbfb3]">GPT picks the art direction and writes a detailed square-image prompt from the selected content type and real card data.</p> : null}
              </>

              <Button className="mt-6 h-11 w-full bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isLoading || (isAiImageGenerator(generatorMode) && aiImagePending)} onClick={generateContent} type="button">
                <RefreshCw className={cn("size-4", (isLoading || aiImagePending) && "animate-spin")} aria-hidden="true" />
                {isAiImageGenerator(generatorMode) ? aiImagePending ? `Generating image, ${aiImageProgress}%` : "Generate AI image" : isCarouselImageGenerator(generatorMode) ? isLoading ? `Creating ${carouselSlideCount} carousel images...` : `Generate ${carouselSlideCount}-image carousel` : isTextGenerator(generatorMode) ? "Generate post" : "Create another Word of the Day"}
              </Button>
            </aside>

            <div className="min-w-0">
              {studioMode === "text" ? (
                <div className="rounded-xl border border-white/10 bg-[#1b1714] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#ffb355]">Generated text</p>
                      <h2 className="mt-1 font-display text-2xl font-semibold">Ready to publish</h2>
                    </div>
                    <div className="flex items-center gap-2"><Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" disabled={!caption} onClick={copyCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button><SocialPublishActions caption={caption} /></div>
                  </div>
                  <textarea className="mt-5 min-h-56 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-4 text-sm leading-6 text-white outline-none" readOnly value={caption} />
                  {funPostError ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#ffb355]">{funPostError}</p> : null}
                  {isLoading ? <p className="mt-3 text-sm text-[#cdbfb3]">Generating content...</p> : null}
                </div>
              ) : isCarouselImageGenerator(generatorMode) ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1b1714]">
                  {carouselCards.length === carouselSlideCount ? <>
                    <div className="border-b border-white/15 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#ffb355]">{isTierProgressionCarouselGenerator(generatorMode) ? "A1 to C1 vocabulary carousel" : "6-image vocabulary carousel"}</p>
                          <p className="mt-1 text-xs leading-5 text-[#cdbfb3]">{isTierProgressionCarouselGenerator(generatorMode) ? `A1, B2, and C1 cards in ${ENGLISH_LANGUAGE_NAMES[language]}, with each tier shown in its own color.` : `Each slide has a random CEFR level and a different ${ENGLISH_LANGUAGE_NAMES[language]} word.`}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={copyCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button>
                          <Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isExporting || isRenderingCarousel || carouselImageUrls.length !== carouselSlideCount} onClick={() => void downloadCarousel()} size="sm" type="button"><Download className="size-4" />{isExporting ? "Preparing PNGs" : isRenderingCarousel ? "Rendering PNGs" : `Download ${carouselSlideCount} PNGs`}</Button>
                          {carouselImageUrls.length === carouselSlideCount ? <SocialPublishActions caption={carouselCaption} getAssets={createCarouselAssets} /> : null}
                        </div>
                      </div>
                      <textarea className="mt-4 min-h-24 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-3 text-sm leading-6 text-white outline-none" readOnly value={carouselCaption} />
                    </div>
                    <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 w-[440px]">
                      {carouselCards.map((carouselCard, index) => <VocabularyCarouselPost card={carouselCard} key={carouselCard.sourceKey} nativeLanguage={nativeLanguage} presentation={isTierProgressionCarouselGenerator(generatorMode) ? "tier" : "meaning"} onSlideRef={(element) => { carouselSlideRefs.current[index] = element; }} />)}
                    </div>
                    {carouselImageUrls.length === carouselSlideCount ? <div className="flex gap-4 overflow-x-auto p-4 sm:p-5">
                      {carouselImageUrls.map((imageUrl, index) => <div className="shrink-0" key={imageUrl}><Image alt={`Generated vocabulary carousel slide ${index + 1}`} className="aspect-[3/4] w-[360px] rounded-lg bg-[#16120f] object-cover sm:w-[440px]" height={587} src={imageUrl} unoptimized width={440} /></div>)}
                    </div> : <div className="grid min-h-80 place-items-center p-6 text-center">
                      <div>
                        <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" />
                        <h2 className="mt-4 font-display text-2xl font-semibold">Rendering carousel images</h2>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#cdbfb3]">The finished PNG slides will appear here instead of editable UI components.</p>
                      </div>
                    </div>}
                  </> : <div className="grid min-h-80 place-items-center p-6 text-center">
                    <div>
                      {isLoading ? <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" /> : <ImageIcon className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />}
                      <h2 className="mt-4 font-display text-2xl font-semibold">{isLoading ? `Creating ${carouselSlideCount} carousel images` : isTierProgressionCarouselGenerator(generatorMode) ? "Create an A1 to C1 carousel" : "Create a vocabulary carousel"}</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#cdbfb3]">{carouselError || (isLoading ? "Vocabulary cards are being prepared." : isTierProgressionCarouselGenerator(generatorMode) ? "Choose the learning and native languages. Each run creates A1, B2, and C1 3:4 card visuals without AI generation." : "Choose the learning and native languages. Each run creates six different 3:4 card visuals without AI generation.")}</p>
                    </div>
                  </div>}
                </div>
              ) : isAiImageGenerator(generatorMode) ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1b1714]">
                  {aiImageUrl ? <>
                    {/* The authenticated server route returns this GPT Image result as a data URL. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Generated FoxiesDeck social visual" className="aspect-square w-full bg-[#100d0c] object-cover" src={aiImageUrl} />
                    <div className="border-t border-white/15 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#ffb355]">Generated caption</p>
                          <p className="mt-1 text-xs text-[#cdbfb3]">Hook and hashtags, ready to publish.</p>
                        </div>
                        <div className="flex gap-2">
                          <Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" disabled={!aiImageCaption} onClick={copyAiImageCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button>
                          <Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isExporting} onClick={downloadAiImage} type="button"><Download className="size-4" />{isExporting ? "Preparing PNG" : "Download PNG"}</Button><SocialPublishActions caption={aiImageCaption} getAsset={createAiImageAsset} />
                        </div>
                      </div>
                      <textarea className="mt-3 min-h-28 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-3 text-sm leading-6 text-white outline-none" readOnly value={aiImageCaption} />
                      {aiImageArtDirection ? <details className="mt-3 min-w-0 max-w-full text-xs text-[#cdbfb3]"><summary className="cursor-pointer text-[#ffb355]">GPT art direction</summary><p className="mt-2 max-w-xl whitespace-pre-wrap leading-5">{aiImageArtDirection}</p></details> : null}
                    </div>
                  </> : <div className="grid min-h-80 place-items-center p-6 text-center">
                    <div>
                      {aiImagePending ? <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" /> : <ImageIcon className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />}
                      <h2 className="mt-4 font-display text-2xl font-semibold">{aiImagePending ? "GPT Image is creating your image" : "Create an AI image"}</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#cdbfb3]">{aiImageError || aiImagePending ? aiImageError || "GPT Image is rendering the square visual with your FoxiesDeck brand references." : "Choose a campaign mode, language, and level. GPT writes the art direction, then GPT Image creates the square visual."}</p>
                      {aiImagePending ? <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#f5ac27] transition-[width] duration-500" style={{ width: `${Math.max(4, aiImageProgress)}%` }} /></div> : null}
                    </div>
                  </div>}
                </div>
              ) : generatorMode === "word-of-the-day-poster" ? card ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                  {posterImageUrl ? <Image alt="Rendered Word of the Day poster" className="aspect-[4/3] w-full bg-black object-cover" height={768} src={posterImageUrl} unoptimized width={1024} /> : <div className="grid aspect-[4/3] place-items-center bg-black p-6 text-center"><div>{isRenderingLocalImage ? <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" /> : <ImageIcon className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />}<p className="mt-3 text-sm text-[#cdbfb3]">{localImageRenderError || "Rendering poster image..."}</p></div></div>}
                  <div
                    ref={posterExportRef}
                    data-social-word-poster
                    className="pointer-events-none fixed left-[-10000px] top-0 aspect-[4/3] w-[1024px] overflow-hidden px-10 py-7 text-white"
                    style={{ backgroundColor: posterTierPalette?.base }}
                  >
                    <div className="absolute inset-0" style={{ background: `linear-gradient(142deg, ${posterTierPalette?.base ?? "#059669"} 0%, ${posterTierPalette?.deep ?? "#064e3b"} 100%)` }} />
                    <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ backgroundColor: posterTierPalette?.deep }} />
                    <div className="absolute inset-3 border sm:inset-5" style={{ borderColor: `${posterTierPalette?.accent ?? "#a7f3d0"}a6` }} />
                    <div className="absolute left-5 right-5 top-[34%] h-px sm:left-10 sm:right-10" style={{ backgroundColor: `${posterTierPalette?.accent ?? "#a7f3d0"}8c` }} />

                    <style>{`
                      .social-word-poster-front [data-card-face] > div,
                      .social-word-poster-back [data-card-face] > div,
                      .social-word-poster-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
                      .social-word-poster-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
                      .social-word-poster-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
                    `}</style>

                    <div className="relative z-10 translate-y-2 sm:translate-y-3">
                      <div>
                        <div className="relative h-[22px] w-28 overflow-hidden sm:h-9 sm:w-48">
                          <Image alt="FoxiesDeck" className="object-[50%_48%] object-cover" fill sizes="(min-width: 640px) 12rem, 7rem" src="/splash.png" unoptimized />
                        </div>
                        <h2 className="mt-1 max-w-[11rem] font-display text-[1.1rem] font-semibold leading-[0.92] sm:max-w-sm sm:text-4xl">
                          {ENGLISH_LANGUAGE_NAMES[card.language].toUpperCase()} WORD OF THE DAY
                        </h2>
                      </div>
                    </div>

                    <div className="pointer-events-none absolute bottom-2 right-3 z-0 w-20 rotate-6 sm:bottom-5 sm:right-7 sm:w-32">
                      <Image alt="" className="h-auto w-full object-contain" height={512} src="/mascots/mascot16.webp" unoptimized width={512} />
                    </div>

                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-max -translate-x-1/2 -translate-y-1/2 items-center gap-6 sm:gap-16">
                      <div className="social-word-poster-front w-[116px] sm:w-[220px]">
                        <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
                      </div>
                      <div className="social-word-poster-back w-[116px] sm:w-[220px]">
                        <VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} />
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-5 z-10 max-w-[64%] sm:bottom-7 sm:left-10 sm:max-w-[66%]">
                      <p className="text-[8px] font-semibold leading-3 text-white sm:text-base sm:leading-6">{card.examples[0]?.sentence ?? card.example}</p>
                    </div>
                  </div>
                  <div className="border-t border-white/15 bg-[#1b1714] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#ffb355]">Post caption</p>
                        <p className="mt-1 text-xs text-[#cdbfb3]">Ready-to-publish text and hashtags.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" disabled={!caption} onClick={copyCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button>
                        <Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isExporting || !posterImageUrl} onClick={downloadPoster} type="button"><Download className="size-4" />{isExporting ? "Preparing PNG" : isRenderingLocalImage ? "Rendering PNG" : "Download PNG"}</Button>{posterImageUrl ? <SocialPublishActions caption={caption} getAsset={async () => ({ dataUrl: posterImageUrl, mimeType: "image/png" })} /> : null}
                      </div>
                    </div>
                    <textarea className="mt-3 min-h-28 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-3 text-sm leading-6 text-white outline-none" readOnly value={caption} />
                  </div>
                </div>
              ) : <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/20 bg-[#1b1714] p-6 text-center text-sm text-[#cdbfb3]">{isLoading ? "Creating Word of the Day poster..." : "No card was found for this selection."}</div> : card ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-[#1b1714] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#ffb355]">Post text</p>
                        <h2 className="mt-1 font-display text-2xl font-semibold">Word of the Day</h2>
                      </div>
                      <Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" disabled={!caption} onClick={copyCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button>
                    </div>
                    <textarea className="mt-4 min-h-36 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-4 text-sm leading-6 text-white outline-none" readOnly value={caption} />
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                    {cardImageUrl ? <Image alt="Rendered Word of the Day visual" className="h-auto w-full bg-black object-contain" height={640} src={cardImageUrl} unoptimized width={1024} /> : <div className="grid min-h-80 place-items-center bg-black p-6 text-center"><div>{isRenderingLocalImage ? <RefreshCw className="mx-auto size-8 animate-spin text-[#ffb355]" aria-hidden="true" /> : <ImageIcon className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />}<p className="mt-3 text-sm text-[#cdbfb3]">{localImageRenderError || "Rendering card image..."}</p></div></div>}
                    <div ref={exportRef} className="social-card-export pointer-events-none fixed left-[-10000px] top-0 w-[1024px] bg-black px-12 py-10">
                      <style>{`
                        .social-card-export .social-card-front [data-card-face] > div,
                        .social-card-export .social-card-back [data-card-face] > div,
                        .social-card-export .social-card-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
                        .social-card-export .social-card-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
                        .social-card-export .social-card-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
                      `}</style>
                      <div className="mx-auto flex max-w-4xl items-center justify-start gap-5 overflow-x-auto pb-2 sm:justify-center sm:gap-14">
                        <div className="social-card-front w-[228px] shrink-0 sm:w-[300px]"><VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} /></div>
                        <div className="social-card-back w-[228px] shrink-0 sm:w-[300px]"><VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} /></div>
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-white/15 bg-[#1b1714] p-4">
                      <Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isExporting || !cardImageUrl} onClick={downloadImage} type="button"><Download className="size-4" />{isExporting ? "Preparing PNG" : isRenderingLocalImage ? "Rendering PNG" : "Download PNG"}</Button>{cardImageUrl ? <SocialPublishActions caption={caption} getAsset={async () => ({ dataUrl: cardImageUrl, mimeType: "image/png" })} /> : null}
                    </div>
                  </div>
                </div>
              ) : <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/20 bg-[#1b1714] p-6 text-center text-sm text-[#cdbfb3]">{isLoading ? "Creating card visual..." : "No card was found for this selection."}</div>}
            </div>
          </div>
        )}

      </div>

    </section>
  );
}

function cardViewProps(card: VocabularyCard, face: "front" | "back", translationLocale: LanguageCode = "en"): ComponentProps<typeof VocabularyCardView> {
  return { card, face, flippable: false, frontFit: true, showActions: false, translationLocale };
}
