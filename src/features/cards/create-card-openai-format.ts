import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { MAX_CUSTOM_CARD_BATCH_SIZE } from "@/features/cards/create-card-schema";

const localizedRecordSchema = (maxLength: number) => ({
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(
    LOCALE_CODES.map((code) => [code, { type: "string", minLength: 1, maxLength }]),
  ),
  required: [...LOCALE_CODES],
});

/** The shared Structured Outputs format used by both single and batch creation. */
export const CUSTOM_CARD_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "custom_vocabulary_card",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      language: { type: "string", enum: [...LANGUAGE_CODES] },
      tier: { type: "string", enum: [...TIERS] },
      termKind: { type: "string", enum: ["word", "fixed_phrase"] },
      term: { type: "string", minLength: 1, maxLength: 120 },
      partOfSpeech: { type: "string", maxLength: 60 },
      pronunciation: { type: "string", minLength: 1, maxLength: 120 },
      translations: localizedRecordSchema(200),
      examples: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sentence: { type: "string", minLength: 1, maxLength: 300 },
            translation: { type: "string", minLength: 1, maxLength: 300 },
          },
          required: ["sentence", "translation"],
        },
      },
      definitions: localizedRecordSchema(240),
      grammar: { type: "array", maxItems: 4, items: { type: "string", maxLength: 200 } },
    },
    required: [
      "language",
      "tier",
      "termKind",
      "term",
      "partOfSpeech",
      "pronunciation",
      "translations",
      "examples",
      "definitions",
      "grammar",
    ],
  },
} as const;

export function createCustomCardBatchResponseFormat(expectedCount: number) {
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > MAX_CUSTOM_CARD_BATCH_SIZE) {
    throw new Error("invalid_custom_card_batch_size");
  }

  return {
    type: "json_schema",
    name: "custom_vocabulary_card_batch",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        cards: {
          type: "array",
          minItems: expectedCount,
          maxItems: expectedCount,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              index: { type: "integer", minimum: 0, maximum: expectedCount - 1 },
              card: CUSTOM_CARD_RESPONSE_FORMAT.schema,
            },
            required: ["index", "card"],
          },
        },
      },
      required: ["cards"],
    },
  } as const;
}
