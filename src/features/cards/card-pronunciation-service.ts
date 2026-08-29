import "server-only";

import OpenAI from "openai";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import {
  normalizeGeneratedPronunciation,
  type CardPronunciationResult,
  type CardPronunciationStatus,
} from "@/features/cards/card-pronunciation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LanguageCode } from "@/types/domain";

const TABLE_NAME = "card_pronunciations";
const GENERATION_TIMEOUT_MS = 12_000;
const STALE_PROCESSING_MS = 90_000;
const MAX_OUTPUT_TOKENS = 128;

interface PronunciationRow {
  card_source_key: string;
  pronunciation: string | null;
  status: CardPronunciationStatus;
  processing_started_at: string | null;
}

interface PronunciationSource {
  term: string;
  language: LanguageCode;
  termKind: "word" | "fixed_phrase";
  isCustom: boolean;
}

export async function processOwnedCardPronunciation(
  userId: string,
  sourceKey: string,
): Promise<CardPronunciationResult | null> {
  const supabase = createSupabaseAdminClient();
  const source = await resolveOwnedPronunciationSource(supabase, userId, sourceKey);

  if (!source) {
    return null;
  }

  return processCardPronunciation(supabase, userId, sourceKey, source);
}

/**
 * Resolves a bundled catalog card from the generated static pronunciation map.
 * Catalog cards must never start a per-user GPT job; custom cards still require
 * an owned inventory row through processOwnedCardPronunciation.
 */
export async function processCatalogCardPronunciation(
  _userId: string,
  sourceKey: string,
): Promise<CardPronunciationResult | null> {
  const catalogCard = VOCABULARY_CARDS.find((card) => card.sourceKey === sourceKey);

  if (!catalogCard) {
    return null;
  }

  return catalogCard.pronunciation.trim()
    ? { status: "ready", pronunciation: catalogCard.pronunciation }
    : { status: "failed" };
}

async function processCardPronunciation(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  sourceKey: string,
  source: PronunciationSource,
): Promise<CardPronunciationResult> {

  const current = await readPronunciationRow(supabase, sourceKey);
  if (current?.status === "ready" && current.pronunciation) {
    return { status: "ready", pronunciation: current.pronunciation };
  }
  if (current?.status === "failed") {
    return { status: "failed" };
  }

  if (!current) {
    const { error } = await supabase.from(TABLE_NAME).upsert(
      {
        card_source_key: sourceKey,
        requested_by: userId,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "card_source_key",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw error;
    }
  }

  const claimed = await claimPronunciationJob(supabase, sourceKey);
  if (!claimed) {
    return rowToResult(await readPronunciationRow(supabase, sourceKey));
  }

  try {
    const pronunciation = await generatePronunciation({
      userId,
      term: source.term,
      language: source.language,
      termKind: source.termKind,
    });

    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        pronunciation,
        status: "ready",
        processing_started_at: null,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("card_source_key", sourceKey);

    if (error) {
      throw error;
    }

    if (source.isCustom) {
      const { error: customCardError } = await supabase
        .from("custom_cards")
        .update({ pronunciation })
        .eq("user_id", userId)
        .eq("source_key", sourceKey);

      if (customCardError) {
        throw customCardError;
      }
    }

    return { status: "ready", pronunciation };
  } catch (error) {
    await markPronunciationJobFailed(supabase, sourceKey, error);
    return { status: "failed" };
  }
}

async function resolveOwnedPronunciationSource(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  sourceKey: string,
): Promise<PronunciationSource | null> {
  const { data: inventoryCard, error: ownershipError } = await supabase
    .from("user_cards")
    .select("card_source_key")
    .eq("user_id", userId)
    .eq("card_source_key", sourceKey)
    .maybeSingle();

  if (ownershipError) {
    throw ownershipError;
  }
  if (!inventoryCard) {
    return null;
  }

  const catalogCard = VOCABULARY_CARDS.find((card) => card.sourceKey === sourceKey);
  if (catalogCard) {
    return {
      term: catalogCard.term,
      language: catalogCard.language,
      termKind: catalogCard.termKind,
      isCustom: false,
    };
  }

  const { data: customCard, error: customCardError } = await supabase
    .from("custom_cards")
    .select("term, language, term_kind")
    .eq("user_id", userId)
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (customCardError) {
    throw customCardError;
  }
  if (!customCard) {
    return null;
  }

  return {
    term: String(customCard.term),
    language: customCard.language as LanguageCode,
    termKind: customCard.term_kind === "fixed_phrase" ? "fixed_phrase" : "word",
    isCustom: true,
  };
}

async function readPronunciationRow(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sourceKey: string,
): Promise<PronunciationRow | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("card_source_key, pronunciation, status, processing_started_at")
    .eq("card_source_key", sourceKey)
    .maybeSingle<PronunciationRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function claimPronunciationJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sourceKey: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ status: "processing", processing_started_at: now, updated_at: now })
    .eq("card_source_key", sourceKey)
    .eq("status", "pending")
    .select("card_source_key")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data) {
    return true;
  }

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const staleClaim = await supabase
    .from(TABLE_NAME)
    .update({ status: "processing", processing_started_at: now, updated_at: now })
    .eq("card_source_key", sourceKey)
    .eq("status", "processing")
    .lt("processing_started_at", staleBefore)
    .select("card_source_key")
    .maybeSingle();

  if (staleClaim.error) {
    throw staleClaim.error;
  }

  return Boolean(staleClaim.data);
}

function rowToResult(row: PronunciationRow | null): CardPronunciationResult {
  if (row?.status === "ready" && row.pronunciation) {
    return { status: "ready", pronunciation: row.pronunciation };
  }

  return { status: row?.status === "failed" ? "failed" : "pending" };
}

async function generatePronunciation(input: {
  userId: string;
  term: string;
  language: LanguageCode;
  termKind: "word" | "fixed_phrase";
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.responses.create(
      {
        model: process.env.OPENAI_CARD_PRONUNCIATION_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL,
        instructions: [
          "Generate one accurate Turkish-style phonetic respelling for a FoxiesDeck vocabulary card.",
          "Return only a JSON object with one string field: pronunciation.",
          "Write exactly how a Turkish speaker should read the term aloud, using lowercase Latin letters and the Turkish dotless ı, spaces, apostrophes, and hyphens.",
          "Always write w as v, write the ç sound as ch, and write the ş sound as sh. Never output w, ç, or ş in pronunciation.",
          "Never use IPA, slashes, brackets, stress marks, source-language scripts, accented letters, digits, or punctuation.",
          "The language code identifies the language being pronounced. Derive the sound from that language; do not assume every term is English.",
          "For example, the English word actually is written ekshılly. This is a sound guide, not a translation or a spelling copy.",
          "For phrases, write the full phrase naturally. Return no alternatives, explanations, or notes.",
        ].join("\n"),
        input: JSON.stringify({ term: input.term, language: input.language, termKind: input.termKind }),
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "minimal" },
        store: false,
        text: { format: { type: "text" }, verbosity: "low" },
        safety_identifier: createAiPracticeSafetyIdentifier(input.userId),
      },
      { signal: controller.signal },
    );

    const rawText = extractResponseOutputText(response) ?? "";
    const parsed = JSON.parse(rawText) as { pronunciation?: unknown };
    const pronunciation = normalizeGeneratedPronunciation(parsed.pronunciation);

    if (!pronunciation) {
      throw new Error("The pronunciation response was invalid");
    }

    return pronunciation;
  } finally {
    clearTimeout(timeout);
  }
}

async function markPronunciationJobFailed(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sourceKey: string,
  error: unknown,
) {
  const failureReason = error instanceof Error ? error.message.slice(0, 240) : "generation_failed";

  await supabase
    .from(TABLE_NAME)
    .update({
      status: "failed",
      pronunciation: null,
      processing_started_at: null,
      failure_reason: failureReason,
      updated_at: new Date().toISOString(),
    })
    .eq("card_source_key", sourceKey);
}
