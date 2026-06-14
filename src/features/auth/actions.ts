"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthActionState } from "@/features/auth/auth-types";
import {
  createValidationErrorState,
  deleteAccountSchema,
  getFormString,
  loginSchema,
  onboardingSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from "@/features/auth/auth-schemas";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import { ensureUserProfile, getRequestOrigin } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LocaleCode } from "@/types/domain";

async function getActionText() {
  const locale = await getServerLocale();
  return {
    locale,
    t: createTranslator(locale),
  };
}

function authNotConfiguredState(locale: LocaleCode): AuthActionState {
  return {
    status: "error",
    message: createTranslator(locale)("auth.message.notConfigured"),
  };
}

async function createActionSupabaseClient() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  return createSupabaseServerClient();
}

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = loginSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
    next: getFormString(formData, "next"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const { email, password } = parsed.data;
  const nextPath = getSafeNextPath(parsed.data.next, DEFAULT_AUTH_REDIRECT);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: "error",
      message: t("auth.message.invalidCredentials"),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { onboardingCompleted } = await ensureUserProfile(supabase, user);

    if (!onboardingCompleted) {
      redirect(`/register/preferences?next=${encodeURIComponent(nextPath)}`);
    }
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function registerAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = registerSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
    displayName: getFormString(formData, "displayName"),
    next: getFormString(formData, "next"),
    consent: getFormString(formData, "consent"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const nextPath = getSafeNextPath(parsed.data.next, DEFAULT_AUTH_REDIRECT);
  const origin = await getRequestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (data.session && data.user) {
    await ensureUserProfile(supabase, data.user, { displayName: parsed.data.displayName });
    revalidatePath("/", "layout");
    redirect(`/register/preferences?next=${encodeURIComponent(nextPath)}`);
  }

  return {
    status: "success",
    message: t("auth.message.registerConfirmation"),
  };
}

export async function resetPasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = resetPasswordSchema.safeParse({
    email: getFormString(formData, "email"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const origin = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account/update-password")}`,
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: t("auth.message.resetSent"),
  };
}

export async function updatePasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = updatePasswordSchema.safeParse({
    password: getFormString(formData, "password"),
    confirmPassword: getFormString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: t("auth.message.passwordAuthRequired"),
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "success",
    message: t("auth.message.passwordUpdated"),
  };
}

export async function updateProfileAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = profileSchema.safeParse({
    displayName: getFormString(formData, "displayName"),
    preferredLanguageCode: getFormString(formData, "preferredLanguageCode"),
    preferredUiLocale: getFormString(formData, "preferredUiLocale") || locale,
    preferredTier: getFormString(formData, "preferredTier"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: t("auth.message.profileAuthRequired"),
    };
  }

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name: parsed.data.displayName,
      preferred_language_code: parsed.data.preferredLanguageCode,
      preferred_ui_locale: parsed.data.preferredUiLocale ?? locale,
      preferred_tier: parsed.data.preferredTier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/account/settings");

  return {
    status: "success",
    message: t("auth.message.profileSaved"),
  };
}

export async function signInWithGoogleAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState & { url?: string }> {
  const { locale, t } = await getActionText();
  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const nextPath = getSafeNextPath(getFormString(formData, "next"), DEFAULT_AUTH_REDIRECT);
  const origin = await getRequestOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (!data.url) {
    return {
      status: "error",
      message: t("auth.message.googleNoUrl"),
    };
  }

  return {
    status: "success",
    message: "",
    url: data.url,
  };
}

export async function logoutAction() {
  const supabase = await createActionSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function completeOnboardingAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = onboardingSchema.safeParse({
    preferredLanguageCode: getFormString(formData, "preferredLanguageCode"),
    preferredUiLocale: locale,
    preferredTier: getFormString(formData, "preferredTier"),
    next: getFormString(formData, "next"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: t("auth.message.profileAuthRequired"),
    };
  }

  const nextPath = getSafeNextPath(parsed.data.next, DEFAULT_AUTH_REDIRECT);
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      preferred_language_code: parsed.data.preferredLanguageCode,
      preferred_ui_locale: parsed.data.preferredUiLocale ?? locale,
      preferred_tier: parsed.data.preferredTier,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function deleteAccountAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { locale, t } = await getActionText();
  const parsed = deleteAccountSchema.safeParse({
    confirmation: getFormString(formData, "confirmation"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error, locale);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return authNotConfiguredState(locale);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: t("auth.message.deleteAuthRequired"),
    };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;

  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : t("auth.message.deleteNeedsSecret"),
    };
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return {
      status: "error",
      message: deleteError.message,
    };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
