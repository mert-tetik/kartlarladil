import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import type { AuthActionState } from "@/features/auth/auth-types";
import { translate, type TranslationKey } from "@/i18n/dictionaries";
import type { LocaleCode } from "@/types/domain";

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

const nextPathSchema = z.string().optional();
const languageCodeSchema = z.enum(LANGUAGE_CODES);
const localeCodeSchema = z.enum(LOCALE_CODES);
const tierSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("auth.validation.invalidEmail"),
  password: z.string().min(6, "auth.validation.passwordMin"),
  next: nextPathSchema,
});

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("auth.validation.invalidEmail"),
  password: z.string().min(6, "auth.validation.passwordMin"),
  displayName: z
    .string()
    .trim()
    .max(80, "auth.validation.displayNameMax")
    .transform((value) => (value.length > 0 ? value : null)),
  preferredLanguageCode: languageCodeSchema,
  preferredUiLocale: localeCodeSchema.optional(),
  preferredTier: tierSchema,
  next: nextPathSchema,
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("auth.validation.invalidEmail"),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(6, "auth.validation.newPasswordMin"),
    confirmPassword: z.string().min(6, "auth.validation.confirmPasswordRequired"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "auth.validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "auth.validation.displayNameMax")
    .refine((value) => value.length === 0 || value.length >= 2, "auth.validation.displayNameMin")
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
      message: "auth.validation.deleteConfirmation",
    }),
});

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function createValidationErrorState(error: z.ZodError, locale: LocaleCode): AuthActionState {
  const flattened = error.flatten((issue) => translateIssueMessage(locale, issue.message));

  return {
    status: "error",
    message: translate(locale, "auth.validation.checkFields"),
    fieldErrors: flattened.fieldErrors,
  };
}

function translateIssueMessage(locale: LocaleCode, message: string) {
  if (message === "auth.validation.deleteConfirmation") {
    return translate(locale, message as TranslationKey, { confirmation: DELETE_ACCOUNT_CONFIRMATION });
  }

  return message.startsWith("auth.validation.") ? translate(locale, message as TranslationKey) : message;
}
