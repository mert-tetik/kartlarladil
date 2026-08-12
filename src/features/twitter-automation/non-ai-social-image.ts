import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createWordOfTheDayCaption, getWordOfTheDayTitle } from "@/features/twitter-automation/social-video-titles";
import { createRandomSocialStudioWordOfTheDayPosterCard, resolveSocialStudioVocabularyCard, selectSocialStudioVocabularyTerms } from "@/features/twitter-automation/social-studio-vocabulary";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type NonAiImageMode = "word-of-the-day" | "word-of-the-day-poster";

const TIER_COLORS: Record<Tier, string> = {
  A1: "#047857",
  A2: "#0369a1",
  B1: "#6331c5",
  B2: "#b45309",
  C1: "#be123c",
};

const POSTER_TIER_PALETTES: Record<Tier, { base: string; deep: string; accent: string }> = {
  A1: { base: "#047857", deep: "#043c2d", accent: "#a7f3d0" },
  A2: { base: "#0369a1", deep: "#083b5c", accent: "#bae6fd" },
  B1: { base: "#6331c5", deep: "#3b176f", accent: "#ddd6fe" },
  B2: { base: "#b45309", deep: "#642d0a", accent: "#fde68a" },
  C1: { base: "#be123c", deep: "#6d0c29", accent: "#fecdd3" },
};

const LOGO_IMAGE_DATA_URL = `data:image/webp;base64,${readFileSync(join(process.cwd(), "public", "logo.webp")).toString("base64")}`;

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

async function chooseCard(language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier, mode: NonAiImageMode) {
  if (mode === "word-of-the-day-poster") {
    return await createRandomSocialStudioWordOfTheDayPosterCard(language, nativeLanguage);
  }

  const [term] = await selectSocialStudioVocabularyTerms({ language, nativeLanguage, tier, count: 1, generator: mode });
  return await resolveSocialStudioVocabularyCard(term!, language, nativeLanguage);
}

const SANS_FONT = "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif";
const SERIF_FONT = "Georgia, Times New Roman, Times, serif";

function posterImageSvg(card: VocabularyCard, nativeLanguage: LanguageCode) {
  const palette = POSTER_TIER_PALETTES[card.tier];
  const meaning = card.translations[nativeLanguage] || card.translation || "";
  const meaningDisplay = meaning.toLocaleUpperCase(nativeLanguage);
  const example = card.examples[0]?.sentence ?? card.example ?? "";
  const exampleTranslation = card.examples[0]?.translations[nativeLanguage] ?? card.exampleTranslation;
  const termSize = card.term.length > 12 ? 88 : 120;
  const nativeMeaningSize = meaningDisplay.length > 11 ? 88 : 104;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="poster-background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.base}"/><stop offset="1" stop-color="${palette.deep}"/></linearGradient>
  </defs>
  <rect width="1024" height="768" fill="url(#poster-background)"/>
  <rect width="1024" height="768" fill="${palette.accent}" opacity="0.2"/>
  <text x="48" y="88" fill="#ffffff" font-family="${SANS_FONT}" font-size="48" font-weight="600">${escapeXml(getWordOfTheDayTitle(nativeLanguage).toUpperCase())}</text>
  <text x="976" y="92" text-anchor="end" fill="#ffffff" font-family="Super Water, ${SANS_FONT}" font-size="68" font-weight="600">${card.tier}</text>
  <text x="512" y="198" text-anchor="middle" fill="#ffffff" font-family="${SANS_FONT}" font-size="30" font-weight="500" opacity="0.8">${escapeXml(card.pronunciation)}</text>
  <text x="512" y="342" text-anchor="middle" fill="#ffffff" font-family="${SERIF_FONT}" font-size="${termSize}" font-weight="600">${escapeXml(card.term.toUpperCase())}</text>
  <text x="512" y="478" text-anchor="middle" fill="${palette.accent}" font-family="${SANS_FONT}" font-size="${nativeMeaningSize}" font-weight="500">${escapeXml(meaningDisplay)}</text>
  <text x="512" y="660" text-anchor="middle" fill="#ffffff" font-family="${SANS_FONT}" font-size="32">${escapeXml(example)}</text>
  <text x="512" y="706" text-anchor="middle" fill="#ffffff" font-family="${SANS_FONT}" font-size="28" opacity="0.8">${escapeXml(exampleTranslation)}</text>
  <image href="${LOGO_IMAGE_DATA_URL}" x="40" y="640" width="112" height="112" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

function imageSvg(card: VocabularyCard, nativeLanguage: LanguageCode, mode: NonAiImageMode) {
  if (mode === "word-of-the-day-poster") {
    return posterImageSvg(card, nativeLanguage);
  }

  const color = TIER_COLORS[card.tier];
  const meaning = card.translations[nativeLanguage] || card.translation || "";
  const label = "FOXIESDECK · WORD CARD";
  const termSize = card.term.length > 12 ? 104 : 136;
  const example = card.examples[0]?.sentence ?? card.example ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#11100f"/>
  <circle cx="900" cy="142" r="280" fill="${color}" opacity="0.34"/>
  <circle cx="126" cy="972" r="370" fill="${color}" opacity="0.16"/>
  <text x="84" y="118" fill="#d9e4dc" font-family="${SANS_FONT}" font-size="30" font-weight="700" letter-spacing="3">${escapeXml(label)}</text>
  <rect x="84" y="202" width="912" height="676" rx="42" fill="#f8f4eb"/>
  <rect x="122" y="242" width="150" height="54" rx="27" fill="${color}"/>
  <text x="197" y="278" text-anchor="middle" fill="#fff" font-family="${SANS_FONT}" font-size="26" font-weight="700">${card.tier}</text>
  <text x="122" y="408" fill="#201d19" font-family="${SERIF_FONT}" font-size="${termSize}" font-weight="700">${escapeXml(card.term)}</text>
  <line x1="122" y1="472" x2="894" y2="472" stroke="#d5cec3" stroke-width="3"/>
  <text x="122" y="558" fill="#5a514a" font-family="${SANS_FONT}" font-size="38">${escapeXml(meaning)}</text>
  <text x="122" y="652" fill="#292520" font-family="${SANS_FONT}" font-size="32">${escapeXml(example)}</text>
  <text x="122" y="794" fill="${color}" font-family="${SANS_FONT}" font-size="30" font-weight="700">Learn it. Keep it. Use it.</text>
  <text x="84" y="964" fill="#c8d5cc" font-family="${SANS_FONT}" font-size="28">foxiesdeck.com</text>
</svg>`;
}

export async function createNonAiSocialImage({ language, nativeLanguage, tier, mode }: {
  language: LanguageCode;
  nativeLanguage: LanguageCode;
  tier: Tier;
  mode: NonAiImageMode;
}) {
  const card = await chooseCard(language, nativeLanguage, tier, mode);
  const resvg = new Resvg(imageSvg(card, nativeLanguage, mode), {
    fitTo: { mode: "width", value: 1080 },
    font: { fontFiles: [join(process.cwd(), "public", "fonts", "super-water.ttf")] },
  });
  const png = resvg.render().asPng();
  return { dataUrl: `data:image/png;base64,${Buffer.from(png).toString("base64")}`, caption: createWordOfTheDayCaption(card, nativeLanguage) };
}
