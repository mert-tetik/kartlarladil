import "server-only";

import sharp from "sharp";
import { resolveSocialStudioVocabularyCard, selectSocialStudioVocabularyTerms } from "@/features/twitter-automation/social-studio-vocabulary";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type NonAiImageMode = "word-of-the-day" | "word-of-the-day-poster";

const TIER_COLORS: Record<Tier, string> = {
  A1: "#047857",
  A2: "#0369a1",
  B1: "#6331c5",
  B2: "#b45309",
  C1: "#be123c",
};

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

async function chooseCard(language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier, mode: NonAiImageMode) {
  const [term] = await selectSocialStudioVocabularyTerms({ language, nativeLanguage, tier, count: 1, generator: mode });
  return await resolveSocialStudioVocabularyCard(term!, language, nativeLanguage);
}

function captionFor(card: VocabularyCard) {
  const language = LANGUAGE_NAMES[card.language].toUpperCase();
  const example = card.examples[0]?.sentence ?? card.example;
  const tag = LANGUAGE_NAMES[card.language].toLowerCase().replaceAll(" ", "");
  return `${language} WORD OF THE DAY!! ${example}\n\n#${tag} #language #wordoftheday`;
}

const SANS_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF_FONT = "Georgia, 'Times New Roman', Times, serif";

function imageSvg(card: VocabularyCard, nativeLanguage: LanguageCode, mode: NonAiImageMode) {
  const color = TIER_COLORS[card.tier];
  const meaning = card.translations[nativeLanguage] || card.translation || "";
  const label = mode === "word-of-the-day-poster" ? "WORD OF THE DAY" : "FOXIESDECK · WORD CARD";
  const termSize = card.term.length > 12 ? 104 : 136;
  const example = card.examples[0]?.sentence ?? card.example ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="#11100f"/>
  <circle cx="900" cy="142" r="280" fill="${color}" opacity=".34"/>
  <circle cx="126" cy="972" r="370" fill="${color}" opacity=".16"/>
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
  const png = await sharp(Buffer.from(imageSvg(card, nativeLanguage, mode))).png().toBuffer();
  return { dataUrl: `data:image/png;base64,${png.toString("base64")}`, caption: captionFor(card) };
}
