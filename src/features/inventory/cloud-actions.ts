"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { VOCABULARY_CARDS } from "@/data/cards";
import { applyAnswerProgress } from "@/features/quiz/quiz-engine";
import { calculateProgressStats } from "@/features/progress/progress-stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  InventoryCard,
  PracticeAttempt,
  PracticeMode,
  ProgressStats,
  VocabularyCard,
} from "@/types/domain";

const CATALOG_NOT_IMPORTED_MESSAGE = "Kart kataloğu Supabase’e aktarılmamış.";

interface CloudInventoryPayload {
  cards: InventoryCard[];
  attempts: PracticeAttempt[];
}

interface CloudActionResult<T> {
  status: "success" | "error";
  message: string;
  data?: T;
}

interface UserCardRow {
  status: string;
  correct_count: number;
  added_at: string;
  learned_at: string | null;
  cards: NestedCardRow;
}

interface AttemptRow {
  id: string;
  mode: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  created_at: string;
  cards: NestedCardRow;
}

interface SupabaseCardRow {
  id: string;
  source_key: string;
}

type NestedCardRow = { source_key: string } | Array<{ source_key: string }> | null;

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
    return cloudError(error);
  }
}

export async function addCloudInventoryCardAction(sourceKey: string): Promise<CloudActionResult<CloudInventoryPayload>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const card = await resolveSupabaseCard(supabase, sourceKey);

    const { error } = await supabase.from("user_cards").upsert(
      {
        user_id: user.id,
        card_id: card.id,
      },
      {
        ignoreDuplicates: true,
        onConflict: "user_id,card_id",
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
    return cloudError(error);
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
    const localCard = resolveLocalCard(input.cardId);
    const remoteCard = await resolveSupabaseCard(supabase, input.cardId);
    const currentCard = await readUserCard(supabase, user, remoteCard.id, input.cardId);
    const nextCard =
      input.mode === "learned" ? currentCard : applyAnswerProgress(currentCard, localCard, input.isCorrect);

    const { error: updateError } = await supabase
      .from("user_cards")
      .update({
        status: nextCard.status,
        correct_count: nextCard.correctCount,
        learned_at: nextCard.learnedAt ?? null,
      })
      .eq("user_id", user.id)
      .eq("card_id", remoteCard.id);

    if (updateError) {
      throw updateError;
    }

    const { error: attemptError } = await supabase.from("practice_attempts").insert({
      user_id: user.id,
      card_id: remoteCard.id,
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
    return cloudError(error);
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
    return cloudError(error);
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

    const { data, error } = await supabase
      .from("cards")
      .select("id, source_key")
      .in("source_key", sourceKeys)
      .returns<SupabaseCardRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(CATALOG_NOT_IMPORTED_MESSAGE);
    }

    const cardBySourceKey = new Map(data.map((card) => [card.source_key, card.id]));
    const rows = localCards.flatMap((card) => {
      const remoteCardId = cardBySourceKey.get(card.cardId);

      if (!remoteCardId) {
        return [];
      }

      return {
        user_id: user.id,
        card_id: remoteCardId,
        status: card.status,
        correct_count: card.correctCount,
        added_at: card.addedAt,
        learned_at: card.learnedAt ?? null,
      };
    });

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from("user_cards").upsert(rows, {
        onConflict: "user_id,card_id",
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
    return cloudError(error);
  }
}

export async function getCloudProgressStatsAction(): Promise<CloudActionResult<ProgressStats>> {
  try {
    const { supabase, user } = await getAuthedSupabase();
    const payload = await listCloudInventory(supabase, user);

    return {
      status: "success",
      message: "",
      data: calculateProgressStats(toInventoryViews(payload.cards)),
    };
  } catch (error) {
    return cloudError(error);
  }
}

async function getAuthedSupabase() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Oturum bulunamadı.");
  }

  return { supabase, user };
}

async function listCloudInventory(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
): Promise<CloudInventoryPayload> {
  const { data: cardRows, error: cardsError } = await supabase
    .from("user_cards")
    .select("status, correct_count, added_at, learned_at, cards!inner(source_key)")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false })
    .returns<UserCardRow[]>();

  if (cardsError) {
    throw cardsError;
  }

  const { data: attemptRows, error: attemptsError } = await supabase
    .from("practice_attempts")
    .select("id, mode, selected_answer, correct_answer, is_correct, created_at, cards!inner(source_key)")
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

async function resolveSupabaseCard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  sourceKey: string,
) {
  const { data, error } = await supabase
    .from("cards")
    .select("id, source_key")
    .eq("source_key", sourceKey)
    .maybeSingle<SupabaseCardRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(CATALOG_NOT_IMPORTED_MESSAGE);
  }

  return data;
}

async function readUserCard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
  remoteCardId: string,
  sourceKey: string,
): Promise<InventoryCard> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("status, correct_count, added_at, learned_at")
    .eq("user_id", user.id)
    .eq("card_id", remoteCardId)
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
      card_id: remoteCardId,
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
  const card = getNestedCard(row.cards);

  if (!card) {
    return [];
  }

  return [
    {
      cardId: card.source_key,
      status: row.status === "learned" ? "learned" : "active",
      correctCount: row.correct_count,
      addedAt: row.added_at,
      learnedAt: row.learned_at ?? undefined,
    },
  ];
}

function mapAttemptRow(row: AttemptRow): PracticeAttempt[] {
  const card = getNestedCard(row.cards);

  if (!card) {
    return [];
  }

  return [
    {
      id: row.id,
      cardId: card.source_key,
      selectedAnswer: row.selected_answer,
      correctAnswer: row.correct_answer,
      isCorrect: row.is_correct,
      mode: row.mode === "learned" ? "learned" : "active",
      createdAt: row.created_at,
    },
  ];
}

function getNestedCard(cards: NestedCardRow) {
  if (Array.isArray(cards)) {
    return cards[0] ?? null;
  }

  return cards;
}

function resolveLocalCard(sourceKey: string): VocabularyCard {
  const card = VOCABULARY_CARDS.find((item) => item.id === sourceKey);

  if (!card) {
    throw new Error("Kart yerel katalogda bulunamadı.");
  }

  return card;
}

function toInventoryViews(cards: InventoryCard[]) {
  const cardById = new Map(VOCABULARY_CARDS.map((card) => [card.id, card]));

  return cards.flatMap((inventory) => {
    const card = cardById.get(inventory.cardId);
    return card ? [{ inventory, card }] : [];
  });
}

function cloudError(error: unknown): CloudActionResult<never> {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Supabase işlemi tamamlanamadı.",
  };
}

function revalidateProgressPaths() {
  revalidatePath("/profil");
  revalidatePath("/kartlarim");
  revalidatePath("/ogren");
  revalidatePath("/ogrenilenler");
}
