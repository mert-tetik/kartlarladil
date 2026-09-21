import OpenAI from "openai";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import {
  createCardRequestSchema,
  generatedCardSchema,
  isSupportedCreateCardDirection,
  matchesRequestedTargetLanguage,
  matchesRequestedTargetWritingSystem,
  shouldRetryForDictionaryLemma,
} from "@/features/cards/create-card-schema";
import { buildCreateCardInput, buildCreateCardInstructions } from "@/features/cards/create-card-prompts";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 2200;

const localizedRecordSchema = (maxLength: number) => ({
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(
    LOCALE_CODES.map((code) => [code, { type: "string", minLength: 1, maxLength }]),
  ),
  required: [...LOCALE_CODES],
});

const CUSTOM_CARD_RESPONSE_FORMAT = {
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
      example: { type: "string", minLength: 1, maxLength: 300 },
      exampleTranslation: { type: "string", minLength: 1, maxLength: 300 },
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
      "example",
      "exampleTranslation",
      "definitions",
      "grammar",
    ],
  },
} as const;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ errorCode: "not_configured" }, { status: 503 });
  }

  const parsed = createCardRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (!isSupportedCreateCardDirection(parsed.data.direction, parsed.data.targetLanguage)) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;
  const instructions = buildCreateCardInstructions({
    locale: parsed.data.locale,
    targetLanguage: parsed.data.targetLanguage,
    direction: parsed.data.direction,
  });
  const input = buildCreateCardInput(parsed.data);

  let rawText = "";

  try {
    const response = await openai.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      stream: false,
      store: false,
      text: { format: CUSTOM_CARD_RESPONSE_FORMAT, verbosity: "low" },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });
    rawText = extractResponseOutputText(response) ?? "";
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  let generated = parseGeneratedCard(rawText);
  let previousResponse = rawText;
  let correctionAttempt = 0;

  while (
    correctionAttempt < 2 &&
    (
      !generated ||
      !matchesRequestedTargetLanguage(generated, parsed.data.targetLanguage) ||
      !matchesRequestedTargetWritingSystem(generated, parsed.data.targetLanguage) ||
      shouldRetryForDictionaryLemma(generated, parsed.data.term, parsed.data.targetLanguage)
    )
  ) {
    correctionAttempt += 1;
    const correctionInput = buildCorrectionInput({
      originalInput: input,
      previousResponse,
      targetLanguage: parsed.data.targetLanguage,
    });

    try {
      const correctionResponse = await openai.responses.create({
        model,
        instructions: `${instructions}\n\nThis is dictionary-form correction attempt ${correctionAttempt}. The previous draft failed validation or returned the inflected surface form. The exact user input is ${JSON.stringify(parsed.data.term)}. Rebuild the complete card and obey every rule, especially canonical target-script spelling, dictionary lemma/citation form, and lexical granularity. If the input is one token, termKind MUST be \"word\" and term MUST be exactly one target-language dictionary headword: perform the morphology analysis privately, then output the infinitive/citation form, never the surface form. For example, Spanish \"hablando\" must become \"hablar\", Portuguese \"falando\" must become \"falar\", and Russian \"slu\u015fayu\" must become \"\u0441\u043b\u0443\u0448\u0430\u0442\u044c\". Do not repeat a rejected surface form. If the previous term was already the correct lemma, preserve it; otherwise normalize the input to the dictionary lemma.`,
        input: correctionInput,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "minimal" },
        stream: false,
        store: false,
        text: { format: CUSTOM_CARD_RESPONSE_FORMAT, verbosity: "low" },
        truncation: "auto",
        safety_identifier: createAiPracticeSafetyIdentifier(user.id),
      });
      const correctionText = extractResponseOutputText(correctionResponse) ?? "";
      previousResponse = correctionText;
      generated = parseGeneratedCard(correctionText);
    } catch {
      generated = null;
      previousResponse = "";
    }
  }

  if (
    !generated ||
    !matchesRequestedTargetLanguage(generated, parsed.data.targetLanguage) ||
    !matchesRequestedTargetWritingSystem(generated, parsed.data.targetLanguage) ||
    shouldRetryForDictionaryLemma(generated, parsed.data.term, parsed.data.targetLanguage)
  ) {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  return Response.json(generated, {
    headers: { "Cache-Control": "no-store" },
  });
}

function parseGeneratedCard(rawText: string) {
  try {
    const parsedJson = JSON.parse(rawText);
    const generated = generatedCardSchema.safeParse(parsedJson);
    return generated.success ? generated.data : null;
  } catch {
    return null;
  }
}

function buildCorrectionInput({
  originalInput,
  previousResponse,
  targetLanguage,
}: {
  originalInput: string;
  previousResponse: string;
  targetLanguage?: string;
}) {
  return `${originalInput}

The previous draft is invalid. Correct it and return a complete replacement:
${previousResponse.slice(0, 12000)}

${targetLanguage ? `The target language is exactly ${targetLanguage}. If the input was Latin transliteration, the term must use the native script for ${targetLanguage}; pronunciation is the only place for Latin phonetics.` : "Preserve the requested target language and canonical spelling."}`;
}
