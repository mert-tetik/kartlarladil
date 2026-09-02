import { getCardDefinition, getCardDefinitionKey, type CardDefinitionMap } from "@/data/card-definitions";
import { CARD_DEFINITIONS } from "@/data/card-definitions.generated";
import type { DefinitionQuizQuestion, LocaleCode, VocabularyCard } from "@/types/domain";

export const DEFINITION_QUESTION_PROBABILITY = 0.5;
export const DEFINITION_IMPOSTER_MAX_ATTEMPTS = 20;

export function shouldUseDefinitionQuestion() {
  return Math.random() < DEFINITION_QUESTION_PROBABILITY;
}

export function buildDefinitionQuizQuestion(
  card: VocabularyCard,
  allCards: VocabularyCard[],
  definitionLocale: LocaleCode,
  definitions: CardDefinitionMap = CARD_DEFINITIONS as CardDefinitionMap,
): DefinitionQuizQuestion | null {
  const definition = getCardDefinition(card, definitionLocale, definitions);
  if (!definition || !card.term.trim()) {
    return null;
  }

  const ownDefinitionKey = getCardDefinitionKey(card);
  const candidateByKey = new Map<string, string>();

  for (const candidate of allCards) {
    const candidateDefinitionKey = getCardDefinitionKey(candidate);
    if (candidateDefinitionKey === ownDefinitionKey) {
      continue;
    }

    const candidateDefinition = getCardDefinition(candidate, definitionLocale, definitions);
    if (!candidateDefinition || areSameDefinition(candidateDefinition, definition)) {
      continue;
    }

    if (!candidateByKey.has(candidateDefinitionKey)) {
      candidateByKey.set(candidateDefinitionKey, candidateDefinition);
    }
  }

  const candidates = [...candidateByKey.entries()];
  const imposters: string[] = [];
  const usedDefinitionKeys = new Set<string>();
  const usedDefinitions = new Set<string>([normalizeDefinition(definition)]);

  for (let attempt = 0; attempt < DEFINITION_IMPOSTER_MAX_ATTEMPTS; attempt += 1) {
    if (candidates.length === 0 || imposters.length === 3) {
      break;
    }

    const candidateIndex = Math.floor(Math.random() * candidates.length);
    const candidate = candidates[candidateIndex];
    if (!candidate) {
      continue;
    }

    const [definitionKey, candidateDefinition] = candidate;
    const normalizedCandidate = normalizeDefinition(candidateDefinition);
    if (usedDefinitionKeys.has(definitionKey) || usedDefinitions.has(normalizedCandidate)) {
      continue;
    }

    usedDefinitionKeys.add(definitionKey);
    usedDefinitions.add(normalizedCandidate);
    imposters.push(candidateDefinition);
  }

  if (imposters.length !== 3) {
    return null;
  }

  return {
    card,
    definition,
    options: shuffle([definition, ...imposters]),
    correctAnswer: definition,
  };
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeDefinition(value: string) {
  return value.trim().normalize("NFC").replace(/\s+/gu, " ").toLocaleLowerCase();
}

function areSameDefinition(left: string, right: string) {
  return normalizeDefinition(left) === normalizeDefinition(right);
}
