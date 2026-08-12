import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { getNativeCaptionHeading } from "@/features/twitter-automation/social-video-titles";
import { getLanguageDisplayName } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import type { SelfExampleSentencesContent } from "@/features/twitter-automation/self-example-sentences";
import type { SelfFalseFriendsContent } from "@/features/twitter-automation/self-false-friends";
import type { SelfVocabularyProgressionContent } from "@/features/twitter-automation/self-vocabulary-progression";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export type AutomationSelfImageGenerator = "self-mini-quiz" | "self-false-friends" | "self-daily-challenge" | "self-vocabulary-progression" | "self-example-sentences";
export type AutomationCarouselGenerator = "vocabulary-carousel" | "tier-progression-carousel";

type AutomationSelfVisualInput = {
  mode: AutomationSelfImageGenerator;
  cards: VocabularyCard[];
  nativeLanguage: LanguageCode;
  falseFriends?: SelfFalseFriendsContent | null;
  vocabularyProgression?: SelfVocabularyProgressionContent | null;
  exampleSentences?: SelfExampleSentencesContent | null;
};

const TIER_COLORS: Record<Tier, string> = { A1: "#10b981", A2: "#38bdf8", B1: "#a78bfa", B2: "#fbbf24", C1: "#fb7185" };
const FONT_FILE = join(process.cwd(), "public", "fonts", "super-water.ttf");
const LOGO_IMAGE_DATA_URL = `data:image/webp;base64,${readFileSync(join(process.cwd(), "public", "logo.webp")).toString("base64")}`;

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

function lines(value: string, maxCharacters: number, maxLines = 3) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [""];
  const output: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxCharacters) {
      output.push(current);
      current = word;
      continue;
    }
    current = next;
  }
  if (current) output.push(current);
  return output.slice(0, maxLines).map((line, index) => index === maxLines - 1 && output.length > maxLines ? `${line.slice(0, Math.max(1, maxCharacters - 1))}…` : line);
}

function textLines(value: string, x: number, y: number, options: { fill: string; fontSize: number; lineHeight?: number; anchor?: "start" | "middle" | "end"; weight?: number; family?: string; maxCharacters?: number; maxLines?: number; opacity?: number }) {
  const rows = lines(value, options.maxCharacters ?? 32, options.maxLines ?? 3);
  const lineHeight = options.lineHeight ?? Math.round(options.fontSize * 1.18);
  const offset = ((rows.length - 1) * lineHeight) / 2;
  return rows.map((row, index) => `<text x="${x}" y="${y - offset + index * lineHeight}" text-anchor="${options.anchor ?? "start"}" fill="${options.fill}" font-family="${options.family ?? "Manrope, Arial, sans-serif"}" font-size="${options.fontSize}" font-weight="${options.weight ?? 500}"${options.opacity ? ` opacity="${options.opacity}"` : ""}>${escapeXml(row)}</text>`).join("");
}

function toPngDataUrl(svg: string, width: number) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { fontFiles: [FONT_FILE] } }).render().asPng();
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

function cardMeaning(card: VocabularyCard, nativeLanguage: LanguageCode) {
  return card.translations[nativeLanguage] || card.translation || "";
}

function superWaterDisplay(nativeLanguage: LanguageCode, value: string) {
  return canUseSuperWater(nativeLanguage) ? formatSuperWaterText(nativeLanguage, value).toLocaleUpperCase("en-US") : value;
}

function superWaterFamily(nativeLanguage: LanguageCode) {
  return canUseSuperWater(nativeLanguage) ? "Super Water, Manrope, Arial, sans-serif" : "Manrope, Arial, sans-serif";
}

function frame(width: number, height: number, content: string, background = "#12100e") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${background}"/>
    <rect width="${width}" height="${height}" fill="#f76808" opacity="0.12"/>
    <image href="${LOGO_IMAGE_DATA_URL}" x="48" y="42" width="118" height="118" preserveAspectRatio="xMidYMid meet"/>
    ${content}
  </svg>`;
}

function tierPill(tier: Tier, x: number, y: number) {
  return `<rect x="${x}" y="${y}" width="92" height="42" rx="21" fill="${TIER_COLORS[tier]}"/><text x="${x + 46}" y="${y + 28}" text-anchor="middle" fill="#12100e" font-family="Manrope, Arial, sans-serif" font-size="22" font-weight="700">${tier}</text>`;
}

function vocabularyPanel(card: VocabularyCard, nativeLanguage: LanguageCode, x: number, y: number, width: number, height: number, compact = false) {
  const meaning = cardMeaning(card, nativeLanguage);
  const termSize = compact ? 42 : 58;
  const meaningSize = compact ? 28 : 34;
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" fill="#f9f2e9"/>
    <rect x="${x}" y="${y}" width="${width}" height="12" rx="6" fill="${TIER_COLORS[card.tier]}"/>
    ${tierPill(card.tier, x + 30, y + 34)}
    ${textLines(card.term, x + width / 2, y + height * 0.49, { anchor: "middle", fill: "#211b17", fontSize: termSize, family: "Georgia, serif", weight: 600, maxCharacters: compact ? 16 : 18, maxLines: 2 })}
    ${textLines(meaning, x + width / 2, y + height * 0.76, { anchor: "middle", fill: "#4a4038", fontSize: meaningSize, weight: 600, maxCharacters: compact ? 25 : 29, maxLines: 2 })}
  </g>`;
}

function selfMiniQuiz(input: AutomationSelfVisualInput) {
  const card = input.cards[0];
  if (!card) throw new Error("automation_self_image_cards_missing");
  const title = getNativeCaptionHeading(input.nativeLanguage, "miniQuiz");
  const choices = input.cards.slice(0, 4).map((candidate) => cardMeaning(candidate, input.nativeLanguage));
  const choiceMarkup = choices.map((choice, index) => {
    const colors = ["#d35345", "#4368b9", "#e2a927", "#299d6d"];
    const y = 502 + index * 80;
    return `<rect x="86" y="${y}" width="1028" height="58" rx="14" fill="${colors[index]}"/>${textLines(choice, 600, y + 37, { anchor: "middle", fill: index === 2 ? "#211b17" : "#ffffff", fontSize: 24, weight: 700, maxCharacters: 46, maxLines: 1 })}`;
  }).join("");
  return frame(1200, 900, `${textLines(title, 600, 126, { anchor: "middle", fill: "#ffffff", fontSize: 54, weight: 700, maxCharacters: 30, maxLines: 2 })}
    <rect x="86" y="194" width="1028" height="246" rx="24" fill="#f9f2e9"/>${tierPill(card.tier, 120, 226)}
    ${textLines(card.term, 600, 306, { anchor: "middle", fill: "#211b17", fontSize: 76, family: "Georgia, serif", weight: 600, maxCharacters: 19, maxLines: 2 })}
    ${textLines(card.pronunciation, 600, 394, { anchor: "middle", fill: "#6b625b", fontSize: 26, weight: 500, maxCharacters: 36, maxLines: 1 })}
    ${choiceMarkup}
    ${textLines(superWaterDisplay(input.nativeLanguage, "FoxiesDeck"), 600, 858, { anchor: "middle", fill: "#ffffff", fontSize: 30, family: superWaterFamily(input.nativeLanguage), weight: 600, maxCharacters: 32, maxLines: 1 })}`);
}

function selfDailyChallenge(input: AutomationSelfVisualInput) {
  if (input.cards.length < 3) throw new Error("automation_self_image_cards_missing");
  const title = getNativeCaptionHeading(input.nativeLanguage, "dailyChallenge");
  return frame(1080, 1440, `${textLines(title, 540, 146, { anchor: "middle", fill: "#ffffff", fontSize: 46, weight: 700, maxCharacters: 32, maxLines: 2 })}
    ${input.cards.slice(0, 3).map((card, index) => vocabularyPanel(card, input.nativeLanguage, 80, 256 + index * 332, 920, 284)).join("")}
    ${textLines("FoxiesDeck", 540, 1360, { anchor: "middle", fill: "#ffffff", fontSize: 31, weight: 700, maxCharacters: 42, maxLines: 2 })}`);
}

function selfFalseFriends(input: AutomationSelfVisualInput) {
  const pair = input.falseFriends;
  if (!pair) throw new Error("automation_self_false_friends_missing");
  const title = getNativeCaptionHeading(input.nativeLanguage, "falseFriends");
  const panel = (term: string, tier: Tier, explanation: string, x: number) => `<g><rect x="${x}" y="338" width="430" height="570" rx="26" fill="#f9f2e9"/><rect x="${x}" y="338" width="430" height="16" rx="8" fill="${TIER_COLORS[tier]}"/>${textLines(tier, x + 38, 414, { fill: TIER_COLORS[tier], fontSize: 38, weight: 700, maxCharacters: 3, maxLines: 1 })}${textLines(term, x + 215, 550, { anchor: "middle", fill: "#211b17", fontSize: 57, family: "Georgia, serif", weight: 600, maxCharacters: 14, maxLines: 2 })}<line x1="${x + 36}" y1="660" x2="${x + 394}" y2="660" stroke="${TIER_COLORS[tier]}" stroke-width="4"/>${textLines(explanation, x + 215, 754, { anchor: "middle", fill: "#4a4038", fontSize: 30, weight: 600, maxCharacters: 26, maxLines: 3 })}<rect x="${x}" y="892" width="430" height="16" rx="8" fill="${TIER_COLORS[tier]}"/></g>`;
  return frame(1080, 1080, `${textLines(title, 540, 166, { anchor: "middle", fill: "#ffffff", fontSize: 43, weight: 700, maxCharacters: 35, maxLines: 2 })}${panel(pair.firstTerm, pair.firstTier, pair.firstExplanation, 92)}${panel(pair.secondTerm, pair.secondTier, pair.secondExplanation, 558)}`);
}

function selfVocabularyProgression(input: AutomationSelfVisualInput) {
  const progression = input.vocabularyProgression;
  if (!progression) throw new Error("automation_self_progression_missing");
  const title = getNativeCaptionHeading(input.nativeLanguage, "vocabularyProgression");
  const entries = [
    [progression.beginnerTerm, progression.beginnerTier, progression.beginnerExplanation],
    [progression.intermediateTerm, progression.intermediateTier, progression.intermediateExplanation],
    [progression.advancedTerm, progression.advancedTier, progression.advancedExplanation],
  ] as const;
  return frame(1080, 1080, `<rect width="1080" height="226" fill="#f76808"/>${textLines(title, 540, 150, { anchor: "middle", fill: "#ffffff", fontSize: 42, weight: 700, maxCharacters: 34, maxLines: 2 })}${entries.map(([term, tier, explanation], index) => `<g><rect x="72" y="${286 + index * 238}" width="936" height="194" rx="22" fill="#f9f2e9"/>${tierPill(tier, 108, 322 + index * 238)}${textLines(term, 540, 366 + index * 238, { anchor: "middle", fill: "#211b17", fontSize: 48, family: "Georgia, serif", weight: 600, maxCharacters: 22, maxLines: 1 })}${textLines(explanation, 540, 432 + index * 238, { anchor: "middle", fill: "#4a4038", fontSize: 25, weight: 600, maxCharacters: 58, maxLines: 2 })}</g>`).join("")}`);
}

function selfExampleSentences(input: AutomationSelfVisualInput) {
  const examples = input.exampleSentences?.sentences;
  if (!examples || examples.length !== 3) throw new Error("automation_self_examples_missing");
  const title = getNativeCaptionHeading(input.nativeLanguage, "exampleSentences");
  return frame(1200, 900, `${textLines(title, 600, 110, { anchor: "middle", fill: "#ffffff", fontSize: 48, weight: 700, maxCharacters: 30, maxLines: 1 })}${examples.map((example, index) => { const y = 190 + index * 214; const color = index === 1 ? "#ffffff" : "#FBE4C2"; return `<rect x="64" y="${y}" width="1072" height="178" rx="22" fill="${color}"/><line x1="600" y1="${y + 24}" x2="600" y2="${y + 154}" stroke="#12100e" stroke-width="4"/>${textLines(example.sentence, 332, y + 79, { anchor: "middle", fill: "#211b17", fontSize: 28, weight: 600, maxCharacters: 28, maxLines: 3 })}${textLines(example.translation, 868, y + 79, { anchor: "middle", fill: "#211b17", fontSize: 28, weight: 600, maxCharacters: 30, maxLines: 3 })}`; }).join("")}`);
}

export function renderAutomationSelfImage(input: AutomationSelfVisualInput) {
  const svg = input.mode === "self-mini-quiz"
    ? selfMiniQuiz(input)
    : input.mode === "self-daily-challenge"
      ? selfDailyChallenge(input)
      : input.mode === "self-false-friends"
        ? selfFalseFriends(input)
        : input.mode === "self-vocabulary-progression"
          ? selfVocabularyProgression(input)
          : selfExampleSentences(input);
  return toPngDataUrl(svg, input.mode === "self-mini-quiz" || input.mode === "self-example-sentences" ? 1200 : 1080);
}

function carouselIntro(mode: AutomationCarouselGenerator, language: LanguageCode, nativeLanguage: LanguageCode, cardCount: number) {
  const kind = mode === "vocabulary-carousel" ? "vocabularyCarousel" : "tierProgression";
  const title = getNativeCaptionHeading(nativeLanguage, kind);
  const subheading = mode === "vocabulary-carousel" ? `${cardCount} · ${getLanguageDisplayName(language, nativeLanguage)}` : `A1–C1 · ${cardCount}`;
  return frame(1080, 1440, `<rect width="1080" height="44" fill="#FBE4C2"/><rect y="1396" width="1080" height="44" fill="#FBE4C2"/>${textLines(superWaterDisplay(nativeLanguage, title), 540, 630, { anchor: "middle", fill: "#FBE4C2", fontSize: 68, family: superWaterFamily(nativeLanguage), weight: 600, maxCharacters: 20, maxLines: 2 })}${textLines(subheading, 540, 805, { anchor: "middle", fill: "#ffffff", fontSize: 38, weight: 600, maxCharacters: 30, maxLines: 2 })}`);
}

function carouselSlide(card: VocabularyCard, nativeLanguage: LanguageCode, index: number, total: number) {
  return frame(1080, 1440, `${textLines(`${index} / ${total}`, 1010, 82, { anchor: "end", fill: "#ffffff", fontSize: 26, weight: 700, maxCharacters: 8, maxLines: 1 })}${vocabularyPanel(card, nativeLanguage, 84, 380, 912, 590)}${textLines(card.examples[0]?.sentence ?? card.example ?? "", 540, 1110, { anchor: "middle", fill: "#ffffff", fontSize: 32, weight: 500, maxCharacters: 48, maxLines: 3 })}`);
}

export function renderAutomationCarousel({ cards, mode, language, nativeLanguage }: { cards: VocabularyCard[]; mode: AutomationCarouselGenerator; language: LanguageCode; nativeLanguage: LanguageCode }) {
  if (!cards.length) throw new Error("automation_carousel_cards_missing");
  return [
    toPngDataUrl(carouselIntro(mode, language, nativeLanguage, cards.length), 1080),
    ...cards.map((card, index) => toPngDataUrl(carouselSlide(card, nativeLanguage, index + 1, cards.length), 1080)),
  ];
}
