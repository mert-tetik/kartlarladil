import { z } from "zod";
import { LOCALE_CODES } from "@/data/languages";
import { generatedCardSchema } from "@/features/cards/create-card-schema";
import type { LanguageCode, LocaleCode, TermKind, Tier } from "@/types/domain";

export const cardGrammarRequestSchema = z.object({
  sourceKey: z.string().trim().min(1).max(320).optional(),
  nativeLocale: z.enum(LOCALE_CODES),
  preview: generatedCardSchema.optional(),
  poll: z.boolean().optional().default(false),
}).strict().superRefine((value, context) => {
  if (!value.sourceKey && !value.preview) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceKey"], message: "A source key or preview card is required" });
  }

  if (value.sourceKey && value.preview) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["preview"], message: "Source key and preview card cannot be combined" });
  }
});

export type CardGrammarRequest = z.infer<typeof cardGrammarRequestSchema>;

export const grammarSectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  items: z.array(z.string().trim().min(1).max(400)).min(1).max(8),
}).strict();

export type GrammarSection = z.infer<typeof grammarSectionSchema>;

export const grammarSectionsSchema = z.array(grammarSectionSchema).min(1).max(5);

export const cardGrammarSectionsSchema = z.object({
  sections: grammarSectionsSchema,
}).strict();

export const grammarTraceEventsSchema = z.array(z.string().trim().min(1).max(280)).max(24);

export const cardGrammarResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), sections: grammarSectionsSchema, events: grammarTraceEventsSchema.optional() }),
  z.object({ status: z.literal("pending"), events: grammarTraceEventsSchema.optional() }),
  z.object({ status: z.literal("failed"), errorCode: z.string().optional(), events: grammarTraceEventsSchema.optional() }),
]);

export type CardGrammarResponse = z.infer<typeof cardGrammarResponseSchema>;

export const CARD_GRAMMAR_FORMAT_VERSION = "structured-sections-v8";

export interface GrammarCardSource {
  sourceKey?: string;
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  term: string;
  translation: string;
  pronunciation: string;
  partOfSpeech: string;
}

export interface GrammarCacheIdentity {
  sourceLanguage: LanguageCode;
  nativeLocale: LocaleCode;
  term: string;
  nativeTranslation: string;
  partOfSpeech: string;
  termKind: TermKind;
}

export function buildGrammarCacheIdentityKey(input: GrammarCacheIdentity) {
  return [
    input.sourceLanguage,
    input.nativeLocale,
    normalizeGrammarCachePart(input.term),
    input.termKind,
  ].join("\u001f");
}

export function buildCardGrammarInstructions(input: GrammarCacheIdentity) {
  return [
    "You write concise, accurate grammar notes for a vocabulary-learning app.",
    "Return only one JSON object with exactly this shape: {\"sections\":[{\"title\":\"...\",\"items\":[\"...\"]}]}.",
    `The learning language is ${input.sourceLanguage}. The learner's native language is ${input.nativeLocale}.`,
    `The canonical learning-language term is: ${JSON.stringify(input.term)}.`,
    `Its native-language translation is: ${JSON.stringify(input.nativeTranslation)}.`,
    `Part of speech: ${input.partOfSpeech || "unknown"}. Term kind: ${input.termKind}.`,
    `Write every section title, explanation, label, gloss, and translation entirely in ${input.nativeLocale}. Never write those parts in the learning language ${input.sourceLanguage}; use the learning language only for the term, forms, pronouns, examples, or quoted grammar forms.`,
    "Explain only the essential grammar and usage information for this exact term, then stop; do not write a generic language lesson.",
    "Keep the response compact: use at most five short sections, with at most eight short items per section. Do not write long paragraphs or long example sentences.",
    "Each section must have a short localized title and an array of short factual items. The UI will render the section titles and bullets; do not add markdown markers or hyphens inside the item strings.",
    "Do not repeat the vocabulary term as a section title, first item, opening sentence, or standalone heading; start directly with the first grammar section.",
    "Never create a section titled 'Basic meaning' or any localized equivalent.",
    "Never create a section titled 'Conjugation note' or any localized equivalent; use only the localized equivalent of 'Conjugation'.",
    "If the term is a verb, order the sections exactly like this: first the native-language equivalent of 'Word type', then immediately the native-language equivalent of 'Conjugation'. For nativeLocale 'en' use 'Word type' and 'Conjugation'; for nativeLocale 'tr' use 'Kelime türü' and 'Çekimler'; otherwise use the exact equivalent in nativeLocale.",
    "For every verb conjugation item, include the learning-language subject pronoun, its translation in nativeLocale in parentheses, and the conjugated learning-language form. For example, when nativeLocale is 'en' and the learning language is Turkish: 'ben (I): dinlerim'. Never omit the pronoun or its native-language gloss.",
    "For verbs, put the actual conjugated forms as short individual items under the native-language Conjugation section. Do not write a long note under that section.",
    "State the correct verb type and relevant usage directly in one definitive factual sentence. Never ask a question, expose uncertainty, present alternatives, or write internal analysis such as 'actually', 'maybe', or 'is it'.",
    "Always include a separate section titled with the native-language equivalent of 'Usage' for every term.",
    "For every verb, always include separate sections titled with the native-language equivalents of 'Common Patterns' and 'Collocations', after the Usage section. Never omit these sections. If no fixed pattern or collocation is required, state that briefly in the native language instead of leaving the section empty.",
    "For nouns, include only relevant gender or classifier, plural formation, declension, and common case or preposition patterns.",
    "For adjectives, adverbs, other word types, and fixed phrases, include only the key agreement, placement, comparison, collocation, or usage pattern.",
    "Follow normal capitalization: capitalize the first word of each sentence and proper nouns only; do not capitalize every word in a sentence. Preserve the correct capitalization of learning-language forms.",
    "Write short, natural, easy-to-read sentences. Each item should communicate one fact; use fragments only when the item is an actual conjugated form or another language form.",
    "Do not include introductions, conclusions, repeated translations, long examples, uncertainty notes, questions, meta commentary, reasoning, or analysis.",
    "Do not invent a rule when the term does not require one; state only reliable, useful information.",
  ].join("\n");
}

export const CARD_GRAMMAR_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 80 },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "string", minLength: 1, maxLength: 400 },
          },
        },
        required: ["title", "items"],
      },
    },
  },
  required: ["sections"],
} as const;

export function normalizeGrammarCachePart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}
