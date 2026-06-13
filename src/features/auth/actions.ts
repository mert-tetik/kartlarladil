"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthActionState } from "@/features/auth/auth-types";
import {
  createValidationErrorState,
  deleteAccountSchema,
  getFormString,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from "@/features/auth/auth-schemas";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";
import { ensureUserProfile, getRequestOrigin } from "@/features/auth/auth-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const AUTH_NOT_CONFIGURED_STATE: AuthActionState = {
  status: "error",
  message: "Supabase ortam değişkenleri eksik. .env.local dosyasını kontrol et.",
};

async function createActionSupabaseClient() {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  return createSupabaseServerClient();
}

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
    next: getFormString(formData, "next"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return AUTH_NOT_CONFIGURED_STATE;
  }

  const { email, password } = parsed.data;
  const nextPath = getSafeNextPath(parsed.data.next, DEFAULT_AUTH_REDIRECT);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: "error",
      message: "Email veya şifre hatalı.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureUserProfile(supabase, user);
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function registerAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
    displayName: getFormString(formData, "displayName"),
    preferredLanguageCode: getFormString(formData, "preferredLanguageCode"),
    preferredUiLocale: getFormString(formData, "preferredUiLocale") || undefined,
    preferredTier: getFormString(formData, "preferredTier"),
    next: getFormString(formData, "next"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return AUTH_NOT_CONFIGURED_STATE;
  }

  const nextPath = getSafeNextPath(parsed.data.next, DEFAULT_AUTH_REDIRECT);
  const origin = await getRequestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      data: {
        display_name: parsed.data.displayName,
        preferred_language_code: parsed.data.preferredLanguageCode,
        preferred_ui_locale: parsed.data.preferredUiLocale,
        preferred_tier: parsed.data.preferredTier,
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (data.session && data.user) {
    await ensureUserProfile(supabase, data.user, {
      displayName: parsed.data.displayName,
      preferredLanguageCode: parsed.data.preferredLanguageCode,
      preferredUiLocale: parsed.data.preferredUiLocale,
      preferredTier: parsed.data.preferredTier,
    });
    await supabase.from("user_profiles").upsert(
      {
        user_id: data.user.id,
        display_name: parsed.data.displayName,
        preferred_language_code: parsed.data.preferredLanguageCode,
        preferred_ui_locale: parsed.data.preferredUiLocale ?? "tr",
        preferred_tier: parsed.data.preferredTier,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    revalidatePath("/", "layout");
    redirect(nextPath);
  }

  return {
    status: "success",
    message: "Kayıt alındı. Email doğrulaması açıksa gelen kutundaki bağlantıyla hesabını tamamla.",
  };
}

export async function resetPasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    email: getFormString(formData, "email"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return AUTH_NOT_CONFIGURED_STATE;
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
    message: "Şifre sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.",
  };
}

export async function updatePasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: getFormString(formData, "password"),
    confirmPassword: getFormString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return AUTH_NOT_CONFIGURED_STATE;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: "Şifreyi güncellemek için tekrar giriş yapmalısın.",
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
    message: "Şifren güncellendi.",
  };
}

export async function updateProfileAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = profileSchema.safeParse({
    displayName: getFormString(formData, "displayName"),
    preferredLanguageCode: getFormString(formData, "preferredLanguageCode"),
    preferredUiLocale: getFormString(formData, "preferredUiLocale"),
    preferredTier: getFormString(formData, "preferredTier"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return AUTH_NOT_CONFIGURED_STATE;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: "Profilini güncellemek için giriş yapmalısın.",
    };
  }

  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name: parsed.data.displayName,
      preferred_language_code: parsed.data.preferredLanguageCode,
      preferred_ui_locale: parsed.data.preferredUiLocale ?? "tr",
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
    message: "Profil ayarların kaydedildi.",
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

export async function deleteAccountAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = deleteAccountSchema.safeParse({
    confirmation: getFormString(formData, "confirmation"),
  });

  if (!parsed.success) {
    return createValidationErrorState(parsed.error);
  }

  const supabase = await createActionSupabaseClient();

  if (!supabase) {
    return AUTH_NOT_CONFIGURED_STATE;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: "Hesabı silmek için giriş yapmalısın.",
    };
  }

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;

  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Hesap silme için server secret key gerekli.",
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
