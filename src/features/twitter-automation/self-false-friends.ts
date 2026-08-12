import type { Tier } from "@/types/domain";

export interface SelfFalseFriendsContent {
  firstTerm: string;
  secondTerm: string;
  firstTier: Tier;
  secondTier: Tier;
  firstExplanation: string;
  secondExplanation: string;
}

const SELF_FALSE_FRIENDS_TIERS = new Set<Tier>(["A1", "A2", "B1", "B2", "C1"]);
const TIER_PRIORITY: Record<Tier, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };

export function normalizeSelfFalseFriendsTerm(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

export function orderSelfFalseFriendsByTier(content: SelfFalseFriendsContent): SelfFalseFriendsContent {
  if (TIER_PRIORITY[content.firstTier] >= TIER_PRIORITY[content.secondTier]) return content;

  return {
    firstTerm: content.secondTerm,
    secondTerm: content.firstTerm,
    firstTier: content.secondTier,
    secondTier: content.firstTier,
    firstExplanation: content.secondExplanation,
    secondExplanation: content.firstExplanation,
  };
}

export function isSelfFalseFriendsContent(value: unknown): value is SelfFalseFriendsContent {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SelfFalseFriendsContent>;
  return [candidate.firstTerm, candidate.secondTerm, candidate.firstExplanation, candidate.secondExplanation]
    .every((field) => typeof field === "string" && field.trim().length > 0)
    && SELF_FALSE_FRIENDS_TIERS.has(candidate.firstTier as Tier)
    && SELF_FALSE_FRIENDS_TIERS.has(candidate.secondTier as Tier);
}
