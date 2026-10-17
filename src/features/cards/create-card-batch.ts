import {
  generatedCardSchema,
  matchesRequestedTargetLanguage,
  matchesRequestedTargetWritingSystem,
  shouldRetryForDictionaryLemma,
  type CreateCardRequest,
  type GeneratedCardResponse,
} from "@/features/cards/create-card-schema";

/** Parses, validates, and restores request order for one complete batch response. */
export function parseGeneratedCardBatch(
  rawText: string,
  requests: CreateCardRequest[],
): GeneratedCardResponse[] | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { cards?: unknown }).cards)) {
    return null;
  }

  const results = (payload as { cards: unknown[] }).cards;
  if (results.length !== requests.length) return null;

  const cards = new Array<GeneratedCardResponse | undefined>(requests.length);
  for (const result of results) {
    if (!result || typeof result !== "object") return null;
    const indexedResult = result as { index?: unknown; card?: unknown };
    const { index } = indexedResult;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= requests.length) return null;
    if (cards[index as number]) return null;

    const request = requests[index as number]!;
    const parsedCard = generatedCardSchema.safeParse(indexedResult.card);
    if (!parsedCard.success) return null;

    const generated = parsedCard.data;
    if (
      !matchesRequestedTargetLanguage(generated, request.targetLanguage) ||
      !matchesRequestedTargetWritingSystem(generated, request.targetLanguage) ||
      shouldRetryForDictionaryLemma(generated, request.term, request.targetLanguage)
    ) {
      return null;
    }

    cards[index as number] = generated;
  }

  return cards.every((card): card is GeneratedCardResponse => card !== undefined)
    ? cards
    : null;
}
