"use server";

import { getCurrentAuthUser } from "@/features/auth/auth-session";
import {
  imageTextTranslateResponseSchema,
  normalizeImageTextTranslateResponse,
  type ImageTextSentencePair,
} from "@/features/cards/image-text-translate-schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import type { LanguageCode, LocaleCode } from "@/types/domain";
import { getImageTextTranslationUsage } from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";

interface UserTranslationRow {
  id: string;
  source_language: string;
  native_locale: string;
  sentences: unknown;
  created_at: string;
}

export interface SavedImageTextTranslation {
  id: string;
  sourceLanguage: LanguageCode;
  nativeLocale: LocaleCode;
  sentences: ImageTextSentencePair[];
  createdAt: string;
}

type TranslationActionError = "unauthorized" | "invalid_input" | "database_error";

export type TranslationActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: TranslationActionError };

export interface ImageTextTranslationUsage {
  plan: "free" | "basic" | "pro";
  used: number;
  limit: number | null;
  remaining: number | null;
  canUse: boolean;
}

function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}

function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

export async function getImageTextTranslationCountAction(): Promise<TranslationActionResult<{ totalCount: number }>> {
  const user = await getCurrentAuthUser();
  if (!user) return { success: false, error: "unauthorized" };

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("user_translations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) return { success: false, error: "database_error" };
  return { success: true, data: { totalCount: count ?? 0 } };
}

export async function getImageTextTranslationUsageAction(): Promise<
  TranslationActionResult<ImageTextTranslationUsage>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { success: false, error: "unauthorized" };

  try {
    const entitlements = await getUserEntitlements(user.id);
    const usage = await getImageTextTranslationUsage(user.id, entitlements.effectivePlan);
    return {
      success: true,
      data: {
        plan: entitlements.effectivePlan,
        ...usage,
      },
    };
  } catch {
    return { success: false, error: "database_error" };
  }
}

function mapTranslationRow(row: UserTranslationRow): SavedImageTextTranslation | null {
  if (!isLanguageCode(row.source_language) || !isLocaleCode(row.native_locale)) return null;

  const parsed = imageTextTranslateResponseSchema.safeParse({ sentences: row.sentences });
  if (!parsed.success) return null;

  return {
    id: row.id,
    sourceLanguage: row.source_language,
    nativeLocale: row.native_locale,
    sentences: normalizeImageTextTranslateResponse(parsed.data, {
      sourceLocale: row.source_language,
      translationLocale: row.native_locale,
    }).sentences,
    createdAt: row.created_at,
  };
}

export async function listImageTextTranslationsAction(): Promise<
  TranslationActionResult<{ translations: SavedImageTextTranslation[]; totalCount: number }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { success: false, error: "unauthorized" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_translations")
    .select("id, source_language, native_locale, sentences, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: "database_error" };

  const translations = ((data ?? []) as UserTranslationRow[])
    .map(mapTranslationRow)
    .filter((translation): translation is SavedImageTextTranslation => translation !== null);

  return { success: true, data: { translations, totalCount: translations.length } };
}

export async function saveImageTextTranslationAction(input: {
  sourceLanguage: LanguageCode;
  nativeLocale: LocaleCode;
  sentences: ImageTextSentencePair[];
}): Promise<TranslationActionResult<SavedImageTextTranslation>> {
  const user = await getCurrentAuthUser();
  if (!user) return { success: false, error: "unauthorized" };
  if (!input || typeof input !== "object") return { success: false, error: "invalid_input" };

  const parsed = imageTextTranslateResponseSchema.safeParse({ sentences: input.sentences });
  if (!isLanguageCode(input.sourceLanguage) || !isLocaleCode(input.nativeLocale) || !parsed.success) {
    return { success: false, error: "invalid_input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_translations")
    .insert({
      user_id: user.id,
      source_language: input.sourceLanguage,
      native_locale: input.nativeLocale,
      sentences: normalizeImageTextTranslateResponse(parsed.data, {
        sourceLocale: input.sourceLanguage,
        translationLocale: input.nativeLocale,
      }).sentences,
    })
    .select("id, source_language, native_locale, sentences, created_at")
    .single<UserTranslationRow>();

  if (error || !data) return { success: false, error: "database_error" };

  const translation = mapTranslationRow(data);
  return translation
    ? { success: true, data: translation }
    : { success: false, error: "database_error" };
}

export async function deleteImageTextTranslationAction(id: string): Promise<
  TranslationActionResult<{ id: string }>
> {
  const user = await getCurrentAuthUser();
  if (!user) return { success: false, error: "unauthorized" };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false, error: "invalid_input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_translations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return error ? { success: false, error: "database_error" } : { success: true, data: { id } };
}
