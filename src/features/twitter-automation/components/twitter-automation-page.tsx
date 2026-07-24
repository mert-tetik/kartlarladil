"use client";

import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react";
import { Copy, Download, ImageIcon, LockKeyhole, MessageSquareText, RefreshCw, Video } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type StudioMode = "text" | "image" | "video";
type GeneratorMode = "word-caption" | "fun-post" | "word-image";

const STUDIO_MODES: Array<{ value: StudioMode; label: string; description: string; icon: typeof MessageSquareText }> = [
  { value: "text", label: "Text", description: "Captions and GPT posts", icon: MessageSquareText },
  { value: "image", label: "Image", description: "Downloadable card visuals", icon: ImageIcon },
  { value: "video", label: "Video", description: "No video generators yet", icon: Video },
];

const GENERATOR_OPTIONS: Record<Exclude<StudioMode, "video">, Array<{ value: GeneratorMode; label: string; description: string }>> = {
  text: [
    { value: "word-caption", label: "Word of the Day", description: "A ready-to-post caption from a real card" },
    { value: "fun-post", label: "Fun FoxiesDeck Post", description: "A playful GPT post about the app" },
  ],
  image: [
    { value: "word-image", label: "Word card visual", description: "A real card front and back as a PNG" },
  ],
};

const LANGUAGE_OPTIONS = Object.values(LANGUAGE_BY_CODE);
const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

function createWordCaption(card: VocabularyCard) {
  const language = ENGLISH_LANGUAGE_NAMES[card.language].toUpperCase();
  const example = card.examples[0]?.sentence ?? card.example;
  const tag = ENGLISH_LANGUAGE_NAMES[card.language].toLowerCase().replaceAll(" ", "");
  return `${language} WORD OF THE DAY!! ${example}\n\n#${tag} #language #wordoftheday`;
}

function isCardGenerator(mode: GeneratorMode) {
  return mode === "word-caption" || mode === "word-image";
}

export function SocialContentStudioPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [studioMode, setStudioMode] = useState<StudioMode>("text");
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>("word-caption");
  const [language, setLanguage] = useState<LanguageCode>("de");
  const [tier, setTier] = useState<Tier>("A1");
  const [card, setCard] = useState<VocabularyCard | null>(null);
  const [funPost, setFunPost] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const caption = generatorMode === "fun-post" ? funPost : card ? createWordCaption(card) : "";
  const generatorOptions = studioMode === "video" ? [] : GENERATOR_OPTIONS[studioMode];

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
    if (authenticated !== true || studioMode === "video") return;
    if (generatorMode === "fun-post") {
      void loadFunPost();
      return;
    }

    void loadCard(language, tier);
  // The user explicitly switches generator modes; language and tier changes use their own handlers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, generatorMode, studioMode]);

  async function loadCard(nextLanguage: LanguageCode, nextTier: Tier) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/twitter-automation/card?language=${nextLanguage}&tier=${nextTier}&type=word`);
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json() as { card?: VocabularyCard };
      setCard(payload.card ?? null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFunPost() {
    setIsLoading(true);
    setCard(null);
    try {
      const response = await fetch("/api/twitter-automation/fun-post", { method: "POST" });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }

      const payload = await response.json() as { post?: string };
      setFunPost(payload.post ?? "");
    } finally {
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
    if (nextMode !== "video") setGeneratorMode(GENERATOR_OPTIONS[nextMode][0].value);
  }

  function selectLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    if (isCardGenerator(generatorMode)) void loadCard(nextLanguage, tier);
  }

  function selectTier(nextTier: Tier) {
    setTier(nextTier);
    if (isCardGenerator(generatorMode)) void loadCard(language, nextTier);
  }

  function generateContent() {
    if (generatorMode === "fun-post") {
      void loadFunPost();
      return;
    }

    void loadCard(language, tier);
  }

  async function copyCaption() {
    await navigator.clipboard.writeText(caption);
  }

  async function downloadImage() {
    if (!exportRef.current || !card) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#000000",
      });
      const link = document.createElement("a");
      link.download = `foxiesdeck-${card.language}-${card.tier}-${card.term.toLowerCase().replaceAll(/[^a-z0-9]+/giu, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  }

  if (authenticated !== true) {
    return (
      <section className="relative grid min-h-[calc(100dvh-4rem)] place-items-center overflow-hidden bg-[#12100e] px-4 py-10 text-[#f9f2e9]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(245,172,39,0.28),transparent_28rem),radial-gradient(circle_at_90%_90%,rgba(247,104,8,0.22),transparent_24rem)]" />
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

  return (
    <section className="min-h-[calc(100dvh-4rem)] bg-[#12100e] px-4 py-6 text-[#f9f2e9] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold text-[#ffb355]">FoxiesDeck developer tool</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Social content studio</h1>
          <p className="mt-2 text-sm leading-6 text-[#cdbfb3]">Choose a format first, then create an export-ready post for the right channel.</p>
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {STUDIO_MODES.map((option) => {
            const Icon = option.icon;
            const selected = studioMode === option.value;
            return (
              <button
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                  selected ? "border-[#f5ac27] bg-[#2b211d]" : "border-white/10 bg-[#1b1714] hover:bg-[#231d19]",
                )}
                key={option.value}
                onClick={() => selectStudioMode(option.value)}
                type="button"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", selected ? "bg-[#f5ac27] text-[#251106]" : "bg-white/10 text-[#f5d6a7]")}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-base font-semibold">{option.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-[#cdbfb3]">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        {studioMode === "video" ? (
          <div className="mt-7 grid min-h-72 place-items-center rounded-xl border border-dashed border-white/20 bg-[#1b1714] p-6 text-center">
            <div>
              <Video className="mx-auto size-8 text-[#ffb355]" aria-hidden="true" />
              <h2 className="mt-4 font-display text-2xl font-semibold">Video modes are coming later.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#cdbfb3]">This area is intentionally empty until the first FoxiesDeck video generator is ready.</p>
            </div>
          </div>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit rounded-xl border border-white/10 bg-[#1b1714] p-4 sm:p-5">
              <p className="text-sm font-semibold text-[#ffb355]">{studioMode === "text" ? "Text generators" : "Image generators"}</p>
              <div className="mt-3 space-y-2">
                {generatorOptions.map((option) => (
                  <button
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      generatorMode === option.value ? "border-[#f5ac27] bg-[#2b211d]" : "border-white/10 hover:bg-[#231d19]",
                    )}
                    key={option.value}
                    onClick={() => setGeneratorMode(option.value)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#cdbfb3]">{option.description}</span>
                  </button>
                ))}
              </div>

              {isCardGenerator(generatorMode) ? <>
                <label className="mt-6 block text-sm font-semibold" htmlFor="social-studio-language">Language</label>
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-white/20 bg-[#100d0c] px-3 text-sm text-white outline-none focus:border-[#f5ac27]"
                  id="social-studio-language"
                  onChange={(event) => selectLanguage(event.target.value as LanguageCode)}
                  value={language}
                >
                  {LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{ENGLISH_LANGUAGE_NAMES[item.code]}</option>)}
                </select>
                <p className="mt-5 text-sm font-semibold">Level</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {TIERS.map((item) => (
                    <Button className={tier === item ? "bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" : "border-white/15 bg-[#100d0c] text-[#f9f2e9] hover:bg-[#231d19]"} key={item} onClick={() => selectTier(item)} size="sm" type="button">
                      {item}
                    </Button>
                  ))}
                </div>
              </> : <p className="mt-6 text-sm leading-6 text-[#cdbfb3]">GPT writes a concise English post with a concrete FoxiesDeck benefit, emojis, and natural hashtags.</p>}

              <Button className="mt-6 h-11 w-full bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isLoading} onClick={generateContent} type="button">
                <RefreshCw className={cn("size-4", isLoading && "animate-spin")} aria-hidden="true" />
                {generatorMode === "fun-post" ? "Write another post" : generatorMode === "word-image" ? "Create another image" : "Write another caption"}
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
                    <Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" disabled={!caption} onClick={copyCaption} size="sm" type="button"><Copy className="size-4" />Copy</Button>
                  </div>
                  <textarea className="mt-5 min-h-56 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-4 text-sm leading-6 text-white outline-none" readOnly value={caption} />
                  {isLoading ? <p className="mt-3 text-sm text-[#cdbfb3]">Generating content...</p> : null}
                </div>
              ) : card ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                  <div ref={exportRef} className="social-card-export bg-black px-4 py-10 sm:px-12">
                    <style>{`
                      .social-card-export .social-card-front [data-card-face] > div,
                      .social-card-export .social-card-back [data-card-face] > div,
                      .social-card-export .social-card-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
                      .social-card-export .social-card-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
                      .social-card-export .social-card-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
                    `}</style>
                    <div className="mx-auto flex max-w-4xl items-center justify-start gap-5 overflow-x-auto pb-2 sm:justify-center sm:gap-14">
                      <div className="social-card-front w-[228px] shrink-0 sm:w-[300px]"><VocabularyCardView {...cardViewProps(card, "front")} /></div>
                      <div className="social-card-back w-[228px] shrink-0 sm:w-[300px]"><VocabularyCardView {...cardViewProps(card, "back")} /></div>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-white/15 bg-[#1b1714] p-4">
                    <Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={isExporting} onClick={downloadImage} type="button"><Download className="size-4" />{isExporting ? "Preparing PNG" : "Download PNG"}</Button>
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

function cardViewProps(card: VocabularyCard, face: "front" | "back"): ComponentProps<typeof VocabularyCardView> {
  return { card, face, flippable: false, frontFit: true, showActions: false, translationLocale: "en" };
}
