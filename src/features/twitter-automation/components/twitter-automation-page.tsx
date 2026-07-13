"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Copy, Download, RefreshCw } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type PostType = "word" | "fun";

const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string; description: string }> = [
  { value: "word", label: "Word of the Day", description: "A real card with a downloadable PNG" },
  { value: "fun", label: "Fun FoxiesDeck Post", description: "GPT writes a playful post about the app" },
];

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

export function TwitterAutomationPage() {
  const [postType, setPostType] = useState<PostType>("word");
  const [language, setLanguage] = useState<LanguageCode>("de");
  const [tier, setTier] = useState<Tier>("A1");
  const [card, setCard] = useState<VocabularyCard | null>(null);
  const [funPost, setFunPost] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const caption = postType === "fun" ? funPost : card ? createWordCaption(card) : "";

  async function loadCard(nextLanguage: LanguageCode, nextTier: Tier) {
    setIsLoading(true);
    const response = await fetch(`/api/twitter-automation/card?language=${nextLanguage}&tier=${nextTier}&type=word`);
    const payload = await response.json() as { card?: VocabularyCard };
    setCard(payload.card ?? null);
    setIsLoading(false);
  }

  async function loadFunPost() {
    setIsLoading(true);
    setCard(null);
    const response = await fetch("/api/twitter-automation/fun-post", { method: "POST" });
    const payload = await response.json() as { post?: string };
    setFunPost(payload.post ?? "");
    setIsLoading(false);
  }

  useEffect(() => {
    let disposed = false;

    async function loadInitialCard() {
      const response = await fetch("/api/twitter-automation/card?language=de&tier=A1&type=word");
      const payload = await response.json() as { card?: VocabularyCard };
      if (!disposed) {
        setCard(payload.card ?? null);
        setIsLoading(false);
      }
    }

    void loadInitialCard();
    return () => { disposed = true; };
  }, []);

  function generatePost() {
    if (postType === "fun") {
      void loadFunPost();
      return;
    }

    void loadCard(language, tier);
  }

  function selectPostType(nextPostType: PostType) {
    setPostType(nextPostType);
    if (nextPostType === "fun") {
      void loadFunPost();
      return;
    }

    void loadCard(language, tier);
  }

  function selectLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    void loadCard(nextLanguage, tier);
  }

  function selectTier(nextTier: Tier) {
    setTier(nextTier);
    void loadCard(language, nextTier);
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

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">Twitter post studio</h1>
        <p className="mt-2 text-sm text-foreground-secondary">Internal tool for card posts and GPT-written FoxiesDeck posts.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-border bg-background-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Post type</p>
          <div className="mt-3 space-y-2">
            {POST_TYPE_OPTIONS.map((option) => (
              <button
                className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${postType === option.value ? "border-brand bg-background-muted" : "border-border hover:bg-background-muted"}`}
                key={option.value}
                onClick={() => selectPostType(option.value)}
                type="button"
              >
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-xs text-foreground-secondary">{option.description}</span>
              </button>
            ))}
          </div>

          {postType === "word" ? <>
            <label className="mt-6 block text-sm font-semibold text-foreground" htmlFor="twitter-language">Language</label>
            <select
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
              id="twitter-language"
              onChange={(event) => selectLanguage(event.target.value as LanguageCode)}
              value={language}
            >
              {LANGUAGE_OPTIONS.map((item) => <option key={item.code} value={item.code}>{ENGLISH_LANGUAGE_NAMES[item.code]}</option>)}
            </select>
            <p className="mt-6 text-sm font-semibold text-foreground">Level</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {TIERS.map((item) => <Button key={item} onClick={() => selectTier(item)} size="sm" type="button" variant={tier === item ? "primary" : "secondary"}>{item}</Button>)}
            </div>
          </> : <p className="mt-6 text-sm leading-6 text-foreground-secondary">GPT creates a concise English post with a practical FoxiesDeck benefit and hashtags.</p>}

          <Button className="mt-6 w-full" disabled={isLoading} onClick={generatePost} type="button">
            <RefreshCw className="size-4" />{postType === "fun" ? "Write another post" : "Pick another card"}
          </Button>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="rounded-lg border border-border bg-background-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-foreground">Post text</h2>
              <Button disabled={!caption} onClick={copyCaption} size="sm" type="button" variant="secondary"><Copy className="size-4" />Copy</Button>
            </div>
            <textarea className="mt-4 min-h-28 w-full resize-y rounded-md border border-border bg-background p-3 text-sm text-foreground" readOnly value={caption} />
          </div>

          {postType === "word" && card ? (
            <div className="overflow-hidden rounded-lg border border-border bg-black shadow-sm">
              <div ref={exportRef} className="twitter-card-export bg-black px-5 py-10 sm:px-12">
                <style>{`
                  .twitter-card-export .twitter-card-front [data-card-face] > div,
                  .twitter-card-export .twitter-card-back [data-card-face] > div,
                  .twitter-card-export .twitter-card-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
                  .twitter-card-export .twitter-card-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
                  .twitter-card-export .twitter-card-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
                `}</style>
                <div className="mx-auto flex max-w-4xl items-center justify-center gap-8 sm:gap-14">
                  <div className="twitter-card-front w-[240px] shrink-0 sm:w-[300px]"><VocabularyCardView {...cardViewProps(card, "front")} /></div>
                  <div className="twitter-card-back w-[240px] shrink-0 sm:w-[300px]"><VocabularyCardView {...cardViewProps(card, "back")} /></div>
                </div>
              </div>
              <div className="flex justify-end border-t border-white/15 bg-background-card p-4">
                <Button disabled={isExporting} onClick={downloadImage} type="button"><Download className="size-4" />{isExporting ? "Preparing PNG" : "Download PNG"}</Button>
              </div>
            </div>
          ) : postType === "word" ? <p className="text-sm text-foreground-secondary">{isLoading ? "Loading card." : "No card was found for this selection."}</p> : null}
        </div>
      </div>
    </section>
  );
}

function cardViewProps(card: VocabularyCard, face: "front" | "back"): ComponentProps<typeof VocabularyCardView> {
  return { card, face, flippable: false, frontFit: true, showActions: false, translationLocale: "en" };
}
