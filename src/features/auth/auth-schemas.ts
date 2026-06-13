import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import type { AuthActionState } from "@/features/auth/auth-types";

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

const nextPathSchema = z.string().optional();
const languageCodeSchema = z.enum(LANGUAGE_CODES);
const localeCodeSchema = z.enum(LOCALE_CODES);
const tierSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir email adresi gir."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
  next: nextPathSchema,
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir email adresi gir."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
  displayName: z
    .string()
    .trim()
    .max(80, "Görünen ad en fazla 80 karakter olabilir.")
    .transform((value) => (value.length > 0 ? value : null)),
  preferredLanguageCode: languageCodeSchema,
  preferredUiLocale: localeCodeSchema.optional(),
  preferredTier: tierSchema,
  next: nextPathSchema,
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir email adresi gir."),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(6, "Yeni şifre en az 6 karakter olmalı."),
    confirmPassword: z.string().min(6, "Şifre tekrarını gir."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "Görünen ad en fazla 80 karakter olabilir.")
    .refine((value) => value.length === 0 || value.length >= 2, "Görünen ad en az 2 karakter olmalı.")
    .transform((value) => (value.length > 0 ? value : null)),
  preferredLanguageCode: z
    .union([languageCodeSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  preferredUiLocale: z
    .union([localeCodeSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  preferredTier: z.union([tierSchema, z.literal("")]).transform((value) => (value === "" ? null : value)),
});

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === DELETE_ACCOUNT_CONFIRMATION, {
      message: `Kalıcı silme için ${DELETE_ACCOUNT_CONFIRMATION} yazmalısın.`,
    }),
});

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function createValidationErrorState(error: z.ZodError): AuthActionState {
  return {
    status: "error",
    message: "Bilgileri kontrol edip tekrar dene.",
    fieldErrors: error.flatten().fieldErrors,
  };
}
