import "server-only";

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generatedCardSchema } from "@/features/cards/create-card-schema";
import {
  CARD_GRAMMAR_RESPONSE_SCHEMA,
  CARD_GRAMMAR_FORMAT_VERSION,
  buildGrammarCacheIdentityKey,
  cardGrammarSectionsSchema,
  buildCardGrammarInstructions,
  type CardGrammarRequest,
  type GrammarCacheIdentity,
  type GrammarCardSource,
  type GrammarSection,
} from "@/features/cards/card-grammar";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LocaleCode } from "@/types/domain";

const TABLE_NAME = "shared_card_grammar";
const STALE_PROCESSING_MS = 90_000;
const GENERATION_TIMEOUT_MS = 18_000;
const MAX_OUTPUT_TOKENS = 700;

interface GrammarCacheRow {
  cache_key: string;
  identity_key?: string | null;
  status: "processing" | "ready" | "failed";
  grammar_text: string | null;
  processing_started_at: string | null;
  grammar_format_version?: string | null;
  term?: string;
}

interface GrammarJobClaim {
  cacheKey: string;
  processingStartedAt: string;
  modernSchema: boolean;
}

interface ResolvedGrammarSource extends GrammarCardSource {
  nativeLocale: LocaleCode;
}

interface GrammarTrace {
  events: string[];
  info(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
  finish<T extends Record<string, unknown>>(result: T): T & { events: string[] };
}

function createGrammarTrace(): GrammarTrace {
  const events: string[] = [];
  const write = (level: "info" | "error", message: string, details?: unknown) => {
    events.push(message);
    const log = level === "error" ? console.error : console.info;
    if (details === undefined) {
      log(`[Grammar Guide] ${message}`);
    } else {
      log(`[Grammar Guide] ${message}`, details);
    }
  };

  return {
    events,
    info: (message, details) => write("info", message, details),
    error: (message, details) => write("error", message, details),
    finish: (result) => ({ ...result, events: [...events] }),
  };
}

export async function processCardGrammarRequest(input: CardGrammarRequest) {
  const trace = createGrammarTrace();
  trace.info(`Grammar Guide isteği başladı (${input.poll ? "poll" : "ilk istek"}).`);

  const user = await getCurrentAuthUser();
  if (!user) {
    trace.info("Grammar Guide için kullanıcı oturumu bulunamadı.");
    return trace.finish({ status: "error" as const, errorCode: "auth_required" });
  }

  let source: ResolvedGrammarSource | null;
  try {
    source = await resolveGrammarSource(user.id, input);
  } catch (error) {
    trace.error("Grammar Guide kart kaynağı Supabase'den okunurken hata alındı.", error);
    throw error;
  }

  if (!source) {
    trace.info("Grammar Guide için kart kaynağı bulunamadı.");
    return trace.finish({ status: "error" as const, errorCode: "card_not_found" });
  }

  const identity: GrammarCacheIdentity = {
    sourceLanguage: source.language,
    nativeLocale: source.nativeLocale,
    term: source.term,
    nativeTranslation: source.translation,
    partOfSpeech: source.partOfSpeech,
    termKind: source.termKind,
  };
  const identityKey = buildGrammarCacheIdentityKey(identity);
  const cacheKey = buildGrammarCacheKey(identityKey);
  const supabase = createSupabaseAdminClient();
  trace.info(`Supabase grammar cache kontrol ediliyor (term: ${identity.term}, locale: ${identity.nativeLocale}).`);
  const current = await readGrammarRow(supabase, identity, trace);

  if (current) {
    trace.info(`Supabase grammar cache bulundu; mevcut durum: ${current.status}.`);
  } else {
    trace.info("Supabase grammar cache bulunamadı; yeni üretim akışı başlıyor.");
  }

  if (
    current?.status === "ready" &&
    current.grammar_text &&
    isCurrentGrammar(current, cacheKey)
  ) {
    const sections = parseStoredGrammar(current.grammar_text);
    if (sections) {
      trace.info("Grammar Guide Supabase cache'den yüklendi.");
      return trace.finish({ status: "ready" as const, sections });
    }
    trace.info("Supabase cache bulundu fakat Grammar Guide içeriği geçersiz; yeniden üretilecek.");
  } else if (current?.status === "ready") {
    trace.info("Supabase cache bulundu fakat Grammar Guide içeriği eksik veya eski; yeniden üretilecek.");
  }

  if (current?.status === "processing" && !isStale(current.processing_started_at)) {
    trace.info("Supabase cache bulundu; başka bir Grammar Guide üretimi devam ediyor.");
    return trace.finish({ status: "pending" as const });
  }

  if (current?.status === "processing") {
    trace.info("Supabase cache kaydı stale durumda; Grammar Guide üretimi yeniden başlatılacak.");
  }

  if (current?.status === "failed" && input.poll) {
    trace.info("Supabase cache kaydı başarısız durumda; Grammar Guide üretilemedi.");
    return trace.finish({ status: "failed" as const, errorCode: "grammar_generation_failed" });
  }

  if (current?.status === "failed") {
    trace.info("Supabase cache kaydı başarısız durumda; Grammar Guide üretimi yeniden denenecek.");
  }

  trace.info("Supabase grammar cache üretim kilidi alınıyor.");
  const claim = await claimGrammarJob(supabase, identityKey, cacheKey, source, user.id, current, trace);
  if (!claim) {
    trace.info("Supabase grammar cache üretim kilidi başka bir istek tarafından alındı; kayıt yeniden kontrol ediliyor.");
    const latest = await readGrammarRow(supabase, identity, trace);
    if (
      latest?.status === "ready" &&
      latest.grammar_text &&
      isCurrentGrammar(latest, cacheKey)
    ) {
      const sections = parseStoredGrammar(latest.grammar_text);
      if (sections) {
        trace.info("Başka bir istek tarafından üretilen Grammar Guide Supabase cache'den yüklendi.");
        return trace.finish({ status: "ready" as const, sections });
      }
    }
    if (latest?.status === "failed" && input.poll) {
      trace.info("Başka bir istek Grammar Guide üretirken hata aldı; başarısız durum döndürülüyor.");
      return trace.finish({ status: "failed" as const, errorCode: "grammar_generation_failed" });
    }
    trace.info("Grammar Guide üretimi başka bir istek tarafından yürütülüyor; pending döndürülüyor.");
    return trace.finish({ status: "pending" as const });
  }

  trace.info("Supabase grammar cache üretim kilidi alındı.");

  let stage: "gpt" | "supabase-write" = "gpt";
  try {
    trace.info("GPT ile Grammar Guide üretiliyor.");
    const sections = await generateGrammar(identity, user.id);
    trace.info("GPT ile Grammar Guide üretildi.");

    stage = "supabase-write";
    trace.info("GPT ile üretilen Grammar Guide Supabase'e yazılıyor.");
    const updatePayload: Record<string, unknown> = {
      cache_key: cacheKey,
      grammar_text: JSON.stringify({ sections }),
      status: "ready",
      processing_started_at: null,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    };
    if (claim.modernSchema) {
      updatePayload.grammar_format_version = CARD_GRAMMAR_FORMAT_VERSION;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("cache_key", claim.cacheKey)
      .eq("status", "processing")
      .eq("processing_started_at", claim.processingStartedAt);

    if (error) throw error;
    trace.info("Grammar Guide Supabase'e yazıldı; cache hazır.");
    return trace.finish({ status: "ready" as const, sections });
  } catch (error) {
    if (stage === "gpt") {
      trace.error("GPT ile Grammar Guide üretilemedi; hata alındı.", error);
    } else {
      trace.error("GPT ile üretilen Grammar Guide Supabase'e yazılamadı.", error);
    }

    try {
      await markGrammarJobFailed(supabase, claim, error);
      trace.info("Supabase Grammar Guide kaydı failed olarak işaretlendi.");
    } catch (markError) {
      trace.error("Supabase Grammar Guide kaydı failed olarak işaretlenemedi.", markError);
    }

    return trace.finish({ status: "failed" as const, errorCode: "grammar_generation_failed" });
  }
}

async function resolveGrammarSource(userId: string, input: CardGrammarRequest): Promise<ResolvedGrammarSource | null> {
  if (input.preview) {
    const parsed = generatedCardSchema.safeParse(input.preview);
    if (!parsed.success) return null;

    const preview = buildPreviewVocabularyCard(parsed.data);
    return {
      sourceKey: preview.sourceKey,
      language: preview.language,
      tier: preview.tier,
      termKind: preview.termKind,
      term: preview.term,
      translation: preview.translations[input.nativeLocale] ?? preview.translation,
      pronunciation: preview.pronunciation,
      partOfSpeech: preview.partOfSpeech,
      nativeLocale: input.nativeLocale,
    };
  }

  const catalogCard = VOCABULARY_CARDS.find((card) => card.sourceKey === input.sourceKey);
  if (catalogCard) {
    return {
      sourceKey: catalogCard.sourceKey,
      language: catalogCard.language,
      tier: catalogCard.tier,
      termKind: catalogCard.termKind,
      term: catalogCard.term,
      translation: getPrimaryCardTranslation(catalogCard, input.nativeLocale),
      pronunciation: catalogCard.pronunciation,
      partOfSpeech: catalogCard.partOfSpeech,
      nativeLocale: input.nativeLocale,
    };
  }

  if (!input.sourceKey) return null;

  const supabase = createSupabaseAdminClient();
  const { data: ownedCard, error: ownershipError } = await supabase
    .from("user_cards")
    .select("card_source_key")
    .eq("user_id", userId)
    .eq("card_source_key", input.sourceKey)
    .maybeSingle();

  if (ownershipError) throw ownershipError;
  if (!ownedCard) return null;

  const { data: customCard, error: customCardError } = await supabase
    .from("custom_cards")
    .select("source_key, language, tier, term, term_kind, translations, part_of_speech, pronunciation")
    .eq("user_id", userId)
    .eq("source_key", input.sourceKey)
    .maybeSingle();

  if (customCardError) throw customCardError;
  if (!customCard) return null;

  const translations = (customCard.translations as Record<string, unknown> | null) ?? {};
  const translation = typeof translations[input.nativeLocale] === "string"
    ? String(translations[input.nativeLocale])
    : typeof translations.en === "string" ? translations.en : String(customCard.term);

  return {
    sourceKey: String(customCard.source_key),
    language: customCard.language as ResolvedGrammarSource["language"],
    tier: customCard.tier as ResolvedGrammarSource["tier"],
    termKind: customCard.term_kind === "fixed_phrase" ? "fixed_phrase" : "word",
    term: String(customCard.term),
    translation,
    pronunciation: String(customCard.pronunciation ?? ""),
    partOfSpeech: String(customCard.part_of_speech ?? ""),
    nativeLocale: input.nativeLocale,
  };
}

function buildGrammarCacheKey(identityKey: string) {
  return createHash("sha256").update(identityKey).digest("hex");
}

async function readGrammarRow(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  identity: GrammarCacheIdentity,
  trace?: GrammarTrace,
): Promise<GrammarCacheRow | null> {
  const identityKey = buildGrammarCacheIdentityKey(identity);
  const modernResult = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("identity_key", identityKey)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (!modernResult.error) {
    return (modernResult.data?.[0] as GrammarCacheRow | undefined) ?? null;
  }

  if (!isMissingGrammarCacheColumnError(modernResult.error)) {
    throw modernResult.error;
  }

  trace?.info("Supabase grammar cache yeni kolonları bulunamadı; legacy cache şeması deneniyor.");

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("source_language", identity.sourceLanguage)
    .eq("native_locale", identity.nativeLocale)
    .eq("term", identity.term)
    .eq("term_kind", identity.termKind)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  const normalizedTerm = normalizeGrammarCacheTerm(identity.term);
  const matchingRow = (data ?? []).find((row) => (
    typeof row.term === "string" && normalizeGrammarCacheTerm(row.term) === normalizedTerm
  ));
  return (matchingRow as GrammarCacheRow | undefined) ?? null;
}

async function claimGrammarJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  identityKey: string,
  cacheKey: string,
  source: ResolvedGrammarSource,
  userId: string,
  current: GrammarCacheRow | null,
  trace?: GrammarTrace,
): Promise<GrammarJobClaim | null> {
  const now = new Date().toISOString();

  if (!current) {
    const modernPayload = {
      cache_key: cacheKey,
      identity_key: identityKey,
      source_language: source.language,
      native_locale: source.nativeLocale,
      term: source.term,
      native_translation: source.translation,
      part_of_speech: source.partOfSpeech,
      term_kind: source.termKind,
      grammar_format_version: CARD_GRAMMAR_FORMAT_VERSION,
      status: "processing",
      generated_by: userId,
      processing_started_at: now,
      updated_at: now,
    };
    const legacyPayload = {
      cache_key: cacheKey,
      source_language: source.language,
      native_locale: source.nativeLocale,
      term: source.term,
      native_translation: source.translation,
      part_of_speech: source.partOfSpeech,
      term_kind: source.termKind,
      status: "processing",
      generated_by: userId,
      processing_started_at: now,
      updated_at: now,
    };

    let { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(modernPayload)
      .select("cache_key")
      .maybeSingle();

    let modernSchema = true;
    if (error && isMissingGrammarCacheColumnError(error)) {
      trace?.info("Supabase grammar cache yeni kolonları desteklemiyor; legacy kayıt formatına geçiliyor.");
      ({ data, error } = await supabase
        .from(TABLE_NAME)
        .insert(legacyPayload)
        .select("cache_key")
        .maybeSingle());
      modernSchema = false;
    }

    if (!error && data) {
      trace?.info("Supabase'e yeni Grammar Guide için processing cache kaydı yazıldı.");
      return { cacheKey: data.cache_key, processingStartedAt: now, modernSchema };
    }
    if (error && error.code !== "23505") throw error;
    return null;
  }

  const modernSchema = hasModernGrammarCacheColumns(current);

  if (current.status === "failed") {
    const updatePayload: Record<string, unknown> = {
      status: "processing",
      generated_by: userId,
      processing_started_at: now,
      failure_reason: null,
      updated_at: now,
    };
    if (modernSchema) updatePayload.grammar_format_version = CARD_GRAMMAR_FORMAT_VERSION;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("cache_key", current.cache_key)
      .eq("status", "failed")
      .select("cache_key")
      .maybeSingle();

    if (error) throw error;
    return data?.cache_key ? { cacheKey: data.cache_key, processingStartedAt: now, modernSchema } : null;
  }

  if (current.status === "processing" && isStale(current.processing_started_at)) {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
    const updatePayload: Record<string, unknown> = {
      generated_by: userId,
      processing_started_at: now,
      updated_at: now,
    };
    if (modernSchema) updatePayload.grammar_format_version = CARD_GRAMMAR_FORMAT_VERSION;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("cache_key", current.cache_key)
      .eq("status", "processing")
      .or(`processing_started_at.is.null,processing_started_at.lt.${staleBefore}`)
      .select("cache_key")
      .maybeSingle();

    if (error) throw error;
    return data?.cache_key ? { cacheKey: data.cache_key, processingStartedAt: now, modernSchema } : null;
  }

  if (current.status === "ready") {
    const updatePayload: Record<string, unknown> = {
      status: "processing",
      generated_by: userId,
      processing_started_at: now,
      failure_reason: null,
      updated_at: now,
    };
    if (modernSchema) updatePayload.grammar_format_version = CARD_GRAMMAR_FORMAT_VERSION;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("cache_key", current.cache_key)
      .eq("status", "ready")
      .select("cache_key")
      .maybeSingle();

    if (error) throw error;
    return data?.cache_key ? { cacheKey: data.cache_key, processingStartedAt: now, modernSchema } : null;
  }

  return null;
}

function isStale(processingStartedAt: string | null) {
  if (!processingStartedAt) return true;
  return Date.parse(processingStartedAt) < Date.now() - STALE_PROCESSING_MS;
}

function isCurrentGrammar(row: GrammarCacheRow, cacheKey: string) {
  if (row.grammar_format_version === CARD_GRAMMAR_FORMAT_VERSION) return true;
  return !row.grammar_format_version && row.cache_key === cacheKey;
}

function hasModernGrammarCacheColumns(row: GrammarCacheRow) {
  return Object.prototype.hasOwnProperty.call(row, "identity_key")
    || Object.prototype.hasOwnProperty.call(row, "grammar_format_version");
}

function isMissingGrammarCacheColumnError(error: { code?: string; message?: string }) {
  return error.code === "42703"
    || error.code === "PGRST204"
    || error.message?.includes("identity_key")
    || error.message?.includes("grammar_format_version");
}

function normalizeGrammarCacheTerm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

async function generateGrammar(identity: GrammarCacheIdentity, userId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_GRAMMAR_MODEL?.trim() || process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL,
      instructions: buildCardGrammarInstructions(identity),
      input: JSON.stringify(identity),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      stream: false,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "card_grammar_response",
          strict: true,
          schema: CARD_GRAMMAR_RESPONSE_SCHEMA,
        },
        verbosity: "low",
      },
      safety_identifier: createAiPracticeSafetyIdentifier(userId),
    }, { signal: controller.signal });

    const rawText = extractResponseOutputText(response) ?? "";
    const parsed = cardGrammarSectionsSchema.safeParse(JSON.parse(rawText));
    if (!parsed.success) throw new Error("Invalid grammar response");
    return parsed.data.sections;
  } finally {
    clearTimeout(timeout);
  }
}

function parseStoredGrammar(value: string): GrammarSection[] | null {
  try {
    const parsed = cardGrammarSectionsSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data.sections : null;
  } catch {
    return null;
  }
}

async function markGrammarJobFailed(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  claim: GrammarJobClaim,
  error: unknown,
) {
  const failureReason = error instanceof Error ? error.message.slice(0, 240) : "generation_failed";
  const { error: updateError } = await supabase
    .from(TABLE_NAME)
    .update({ status: "failed", grammar_text: null, processing_started_at: null, failure_reason: failureReason, updated_at: new Date().toISOString() })
    .eq("cache_key", claim.cacheKey)
    .eq("status", "processing")
    .eq("processing_started_at", claim.processingStartedAt);

  if (updateError) throw updateError;
}
