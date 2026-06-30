"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { LOCALE_CODES } from "@/data/languages";
import { VOCABULARY_CARDS } from "@/data/cards";
import { mapDbCustomCardToVocabularyCard } from "@/features/cards/custom-card-mapper";
import type { DbCustomCard, GeneratedCardDraft } from "@/features/cards/custom-card-types";
import { applyAnswerProgress } from "@/features/quiz/quiz-engine";
import { calculateProgressStats } from "@/features/progress/progress-stats";
import {
  checkLimit,
  getUserEntitlements,
} from "@/features/subscriptions/subscription-service";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  InventoryCard,
  LanguageCode,
  LimitErrorCode,
  PracticeAttempt,
  PracticeMode,
  ProgressStats,
  TermKind,
  Tier,
  VocabularyCard,
} from "@/types/domain";
import { randomUUID } from "node:crypto";

interface CloudInventoryPayload {
  cards: InventoryCard[];
  attempts: PracticeAttempt[];
}

interface CloudActionResult<T> {
  status: "success" | "error";
  message: string;
  errorCode?: LimitErrorCode;
  data?: T;
}

interface UserCardRow {
  card_source_key: string;
  status: string;
  correct_count: number;
  added_at: string;
  learned_at: string | null;
}

interface AttemptRow {
  id: string;
  card_source_key: string;
  mode: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  created_at: string;
}

const CLOUD_AUTH_REQUIRED_ERROR = "inventory_auth_required";
const CLOUD_LOCAL_CARD_MISSING_ERROR = "inventory_local_card_missing";

async function getCloudActionText() {
  return createTranslator(await getServerLocale());
}

export async function listCloudInventoryAction(): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const payload = await listCloudInventory(supabase, user);

    return {
      status: "success",
      message: "",
      data: payload,
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function addCloudInventoryCardAction(sourceKey: string): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const card = await resolveLocalCard(supabase, sourceKey);
    const t = await getCloudActionText();
    const entitlements = await getUserEntitlements(user.id);

    if (entitlements.effectivePlan === "free") {
      const activeCount = await countUserCardsByStatus(supabase, user.id, "active");
      const limitError = checkLimit(activeCount, entitlements.limits.activeCards, "free_active_card_limit");

      if (limitError) {
        return {
          status: "error",
          message: t("limit.activeCardLimitDescription"),
          errorCode: limitError,
        };
      }
    }

    const { error } = await supabase.from("user_cards").upsert(
      {
        user_id: user.id,
        card_source_key: card.sourceKey,
      },
      {
        ignoreDuplicates: true,
        onConflict: "user_id,card_source_key",
      },
    );

    if (error) {
      throw error;
    }

    revalidateProgressPaths();

    return {
      status: "success",
      message: "",
      data: await listCloudInventory(supabase, user),
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function recordCloudPracticeAttemptAction(input: {
  cardId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  mode: PracticeMode;
}): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const localCard = await resolveLocalCard(supabase, input.cardId);
    const t = await getCloudActionText();
    const currentCard = await readUserCard(supabase, user, localCard.sourceKey);
    const nextCard =
      input.mode === "learned" ? currentCard : applyAnswerProgress(currentCard, localCard, input.isCorrect);

    const entitlements = await getUserEntitlements(user.id);

    if (
      entitlements.effectivePlan === "free" &&
      currentCard.status !== "learned" &&
      nextCard.status === "learned"
    ) {
      const learnedCount = await countUserCardsByStatus(supabase, user.id, "learned");
      const limitError = checkLimit(learnedCount, entitlements.limits.learnedCards, "free_learned_card_limit");

      if (limitError) {
        return {
          status: "error",
          message: t("limit.learnedCardLimitDescription"),
          errorCode: limitError,
        };
      }
    }

    const { error: updateError } = await supabase
      .from("user_cards")
      .update({
        status: nextCard.status,
        correct_count: nextCard.correctCount,
        learned_at: nextCard.learnedAt ?? null,
      })
      .eq("user_id", user.id)
      .eq("card_source_key", localCard.sourceKey);

    if (updateError) {
      throw updateError;
    }

    const { error: attemptError } = await supabase.from("practice_attempts").insert({
      user_id: user.id,
      card_source_key: localCard.sourceKey,
      mode: input.mode,
      selected_answer: input.selectedAnswer,
      correct_answer: input.correctAnswer,
      is_correct: input.isCorrect,
    });

    if (attemptError) {
      throw attemptError;
    }

    revalidateProgressPaths();

    return {
      status: "success",
      message: "",
      data: await listCloudInventory(supabase, user),
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function resetCloudInventoryAction(): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();

    const { error: attemptsError } = await supabase.from("practice_attempts").delete().eq("user_id", user.id);

    if (attemptsError) {
      throw attemptsError;
    }

    const { error: cardsError } = await supabase.from("user_cards").delete().eq("user_id", user.id);

    if (cardsError) {
      throw cardsError;
    }

    revalidateProgressPaths();

    return {
      status: "success",
      message: "",
      data: await listCloudInventory(supabase, user),
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function removeCloudInventoryCardAction(sourceKey: string): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const card = await resolveLocalCard(supabase, sourceKey);

    const { error: attemptsError } = await supabase
      .from("practice_attempts")
      .delete()
      .eq("user_id", user.id)
      .eq("card_source_key", card.sourceKey);

    if (attemptsError) {
      throw attemptsError;
    }

    const { error: cardsError } = await supabase
      .from("user_cards")
      .delete()
      .eq("user_id", user.id)
      .eq("card_source_key", card.sourceKey);

    if (cardsError) {
      throw cardsError;
    }

    revalidateProgressPaths();

    return {
      status: "success",
      message: "",
      data: await listCloudInventory(supabase, user),
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function migrateLocalInventoryToCloudAction(
  localCards: InventoryCard[],
): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const sourceKeys = [...new Set(localCards.map((card) => card.cardId))];

    if (sourceKeys.length === 0) {
      return {
        status: "success",
        message: "",
        data: await listCloudInventory(supabase, user),
      };
    }

    for (const sourceKey of sourceKeys) {
      await resolveLocalCard(supabase, sourceKey);
    }

    const rows = localCards.map((card) => {
      return {
        user_id: user.id,
        card_source_key: card.cardId,
        status: card.status,
        correct_count: card.correctCount,
        added_at: card.addedAt,
        learned_at: card.learnedAt ?? null,
      };
    });

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from("user_cards").upsert(rows, {
        onConflict: "user_id,card_source_key",
      });

      if (upsertError) {
        throw upsertError;
      }
    }

    revalidateProgressPaths();

    return {
      status: "success",
      message: "",
      data: await listCloudInventory(supabase, user),
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function getCloudProgressStatsAction(): Promise<CloudActionResult<ProgressStats>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const payload = await listCloudInventory(supabase, user);

    return {
      status: "success",
      message: "",
      data: calculateProgressStats(await toInventoryViews(supabase, user, payload.cards)),
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function loadCustomCardsAction(): Promise<CloudActionResult<VocabularyCard[]>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const cards = await fetchCustomCards(supabase, user.id);

    return {
      status: "success",
      message: "",
      data: cards,
    };
  } catch (error) {
    return await cloudError(error);
  }
}

export async function createCustomCardAction(input: {
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  draft: GeneratedCardDraft;
}): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const sourceKey = buildCustomCardSourceKey(user.id);

    const { error: insertError } = await supabase.from("custom_cards").insert({
      user_id: user.id,
      source_key: sourceKey,
      language: input.language,
      tier: input.tier,
      term: input.draft.term,
      term_kind: input.termKind,
      translations: input.draft.translations,
      translation_meanings: Object.fromEntries(
        LOCALE_CODES.map((code) => [code, [input.draft.translations[code]]]),
      ),
      part_of_speech: input.draft.partOfSpeech,
      pronunciation: input.draft.pronunciation,
      examples: [{ example: input.draft.example, translation: input.draft.exampleTranslation }],
      grammar: { notes: input.draft.grammar },
    });

    if (insertError) {
      throw insertError;
    }

    const { error: inventoryError } = await supabase.from("user_cards").upsert(
      {
        user_id: user.id,
        card_source_key: sourceKey,
      },
      {
        ignoreDuplicates: true,
        onConflict: "user_id,card_source_key",
      },
    );

    if (inventoryError) {
      throw inventoryError;
    }

    revalidateProgressPaths();

    return {
      status: "success",
      message: "",
      data: await listCloudInventory(supabase, user),
    };
  } catch (error) {
    return await cloudError(error, { exposeSystemMessage: true });
  }
}

async function getAuthedSupabase() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(CLOUD_AUTH_REQUIRED_ERROR);
  }

  return { supabase, user };
}

async function listCloudInventory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
): Promise<CloudInventoryPayload> {
  const { data: cardRows, error: cardsError } = await supabase
    .from("user_cards")
    .select("card_source_key, status, correct_count, added_at, learned_at")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false })
    .returns<UserCardRow[]>();

  if (cardsError) {
    throw cardsError;
  }

  const { data: attemptRows, error: attemptsError } = await supabase
    .from("practice_attempts")
    .select("id, card_source_key, mode, selected_answer, correct_answer, is_correct, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AttemptRow[]>();

  if (attemptsError) {
    throw attemptsError;
  }

  return {
    cards: (cardRows ?? []).flatMap(mapUserCardRow),
    attempts: (attemptRows ?? []).flatMap(mapAttemptRow),
  };
}

async function readUserCard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
  sourceKey: string,
): Promise<InventoryCard> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("status, correct_count, added_at, learned_at")
    .eq("user_id", user.id)
    .eq("card_source_key", sourceKey)
    .maybeSingle<{
      status: string;
      correct_count: number;
      added_at: string;
      learned_at: string | null;
    }>();

  if (error) {
    throw error;
  }

  if (!data) {
    const inserted = {
      user_id: user.id,
      card_source_key: sourceKey,
    };
    const { error: insertError } = await supabase.from("user_cards").insert(inserted);

    if (insertError) {
      throw insertError;
    }

    return {
      cardId: sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: new Date().toISOString(),
    };
  }

  return {
    cardId: sourceKey,
    status: data.status === "learned" ? "learned" : "active",
    correctCount: data.correct_count,
    addedAt: data.added_at,
    learnedAt: data.learned_at ?? undefined,
  };
}

function mapUserCardRow(row: UserCardRow): InventoryCard[] {
  return [
    {
      cardId: row.card_source_key,
      status: row.status === "learned" ? "learned" : "active",
      correctCount: row.correct_count,
      addedAt: row.added_at,
      learnedAt: row.learned_at ?? undefined,
    },
  ];
}

function mapAttemptRow(row: AttemptRow): PracticeAttempt[] {
  return [
    {
      id: row.id,
      cardId: row.card_source_key,
      selectedAnswer: row.selected_answer,
      correctAnswer: row.correct_answer,
      isCorrect: row.is_correct,
      mode: row.mode === "learned" ? "learned" : "active",
      createdAt: row.created_at,
    },
  ];
}

function findBundledCard(sourceKey: string): VocabularyCard | undefined {
  return VOCABULARY_CARDS.find((item) => item.sourceKey === sourceKey || item.id === sourceKey);
}

async function resolveLocalCard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sourceKey: string,
): Promise<VocabularyCard> {
  const bundled = findBundledCard(sourceKey);

  if (bundled) {
    return bundled;
  }

  const card = await fetchCustomCardBySourceKey(supabase, sourceKey);

  if (card) {
    return card;
  }

  throw new Error(CLOUD_LOCAL_CARD_MISSING_ERROR);
}

async function fetchCustomCardBySourceKey(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sourceKey: string,
): Promise<VocabularyCard | null> {
  const { data, error } = await supabase
    .from("custom_cards")
    .select("*")
    .eq("source_key", sourceKey)
    .maybeSingle<DbCustomCard>();

  if (error) {
    throw error;
  }

  return data ? mapDbCustomCardToVocabularyCard(data) : null;
}

async function fetchCustomCards(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<VocabularyCard[]> {
  const { data, error } = await supabase
    .from("custom_cards")
    .select("*")
    .eq("user_id", userId)
    .returns<DbCustomCard[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDbCustomCardToVocabularyCard);
}

function buildCustomCardSourceKey(userId: string): string {
  return `custom:${userId}:${randomUUID()}`;
}

async function toInventoryViews(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
  cards: InventoryCard[],
) {
  const bundledById = new Map(VOCABULARY_CARDS.map((card) => [card.id, card]));
  const customCards = await fetchCustomCards(supabase, user.id);
  const customBySourceKey = new Map(customCards.map((card) => [card.sourceKey, card]));

  return cards.flatMap((inventory) => {
    const card = bundledById.get(inventory.cardId) ?? customBySourceKey.get(inventory.cardId);
    return card ? [{ inventory, card }] : [];
  });
}

async function countUserCardsByStatus(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  status: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("user_cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", status);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function cloudError(
  error: unknown,
  options: { exposeSystemMessage?: boolean } = {},
): Promise<CloudActionResult<never>> {
  const t = await getCloudActionText();

  if (error instanceof Error && error.message === CLOUD_AUTH_REQUIRED_ERROR) {
    return {
      status: "error",
      message: t("inventory.error.authRequired"),
    };
  }

  if (error instanceof Error && error.message === CLOUD_LOCAL_CARD_MISSING_ERROR) {
    return {
      status: "error",
      message: t("inventory.error.localCatalogMissing"),
    };
  }

  if (options.exposeSystemMessage) {
    const systemMessage = getSystemErrorMessage(error);

    if (systemMessage) {
      return {
        status: "error",
        message: systemMessage,
      };
    }
  }

  return {
    status: "error",
    message: t("inventory.error.operationFailed"),
  };
}

function getSystemErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message.trim() || null;
  }

  if (typeof error !== "object" || error === null) {
    return null;
  }

  const record = error as Record<string, unknown>;
  const parts = [
    typeof record.message === "string" ? record.message : null,
    typeof record.details === "string" ? `Details: ${record.details}` : null,
    typeof record.hint === "string" ? `Hint: ${record.hint}` : null,
    typeof record.code === "string" ? `Code: ${record.code}` : null,
  ].filter((part): part is string => Boolean(part?.trim()));

  return parts.length > 0 ? parts.join(" ") : null;
}

function revalidateProgressPaths() {
  revalidatePath("/profile");
  revalidatePath("/my-cards");
  revalidatePath("/learn");
  revalidatePath("/learned");
}
