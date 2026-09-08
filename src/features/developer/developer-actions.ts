"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VOCABULARY_CARDS } from "@/data/cards";
import { findDeveloperCatalogCards } from "@/features/developer/developer-catalog";
import { getTierRequirement } from "@/features/quiz/quiz-engine";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import {
  getDeveloperUserDetail,
  getDeveloperUsers,
  writeDeveloperAuditLog,
} from "@/features/developer/developer-data";
import type {
  DeveloperActionResult,
  DeveloperCatalogCardMatch,
} from "@/features/developer/developer-types";
import { cancelGooglePlaySubscription } from "@/features/subscriptions/google-play-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const budgetSchema = z.object({
  serviceName: z.string().trim().min(1).max(120),
  monthlyCostTry: z.coerce.number().finite().min(0).max(10_000_000),
  serviceUrl: z.url().max(2048),
  notes: z.string().trim().max(2000).default(""),
  billingDay: z.coerce.number().int().min(1).max(31).nullable(),
  isActive: z.boolean(),
});

const budgetUpdateSchema = budgetSchema.extend({ id: z.string().uuid() });
const idSchema = z.string().uuid();
const subscriptionSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["basic", "pro"]),
  durationDays: z.coerce.number().int().min(1).max(3650),
});
const cardSchema = z.object({
  userId: z.string().uuid(),
  sourceKey: z.string().trim().min(1).max(280),
  status: z.enum(["active", "learned"]),
});
const catalogSearchSchema = z.string().trim().min(2).max(120);
const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  expectedEmail: z.string().trim().email().max(320),
  confirmation: z.string().trim().max(400),
  password: z.string().min(8).max(200),
});

function result(ok: boolean, message: string): DeveloperActionResult {
  return { ok, message };
}

function revalidateDeveloperPaths() {
  revalidatePath("/developer");
  revalidatePath("/developer/budget");
  revalidatePath("/developer/admin");
}

export async function loadDeveloperUsersAction(page: number) {
  await requireDeveloperAdmin("/developer/admin");
  return getDeveloperUsers({ page });
}

export async function loadDeveloperUserDetailAction(userId: string) {
  await requireDeveloperAdmin("/developer/admin");
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return null;
  return getDeveloperUserDetail(parsed.data);
}

export async function searchDeveloperCatalogCardsAction(
  input: string,
): Promise<DeveloperCatalogCardMatch[]> {
  await requireDeveloperAdmin("/developer/admin");
  const parsed = catalogSearchSchema.safeParse(input);
  if (!parsed.success) return [];

  return findDeveloperCatalogCards(parsed.data);
}

async function withAdminAction<T>(
  path: string,
  action: (
    admin: Awaited<ReturnType<typeof requireDeveloperAdmin>>,
  ) => Promise<T>,
) {
  const admin = await requireDeveloperAdmin(path);
  return action(admin);
}

export async function createBudgetItemAction(
  input: unknown,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/budget", async (admin) => {
    const parsed = budgetSchema.safeParse(input);
    if (!parsed.success)
      return result(false, "Bütçe satırındaki alanları kontrol et.");
    try {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("developer_budget_items").insert({
        service_name: parsed.data.serviceName,
        monthly_cost_try: parsed.data.monthlyCostTry,
        service_url: parsed.data.serviceUrl,
        notes: parsed.data.notes,
        billing_day: parsed.data.billingDay,
        is_active: parsed.data.isActive,
      });
      if (error) throw error;
      await writeDeveloperAuditLog({
        actor: admin,
        action: "budget_item_created",
        metadata: { serviceName: parsed.data.serviceName },
      });
      revalidateDeveloperPaths();
      return result(true, "Bütçe satırı Supabase'e kaydedildi.");
    } catch {
      return result(false, "Bütçe satırı kaydedilemedi.");
    }
  });
}

export async function updateBudgetItemAction(
  input: unknown,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/budget", async (admin) => {
    const parsed = budgetUpdateSchema.safeParse(input);
    if (!parsed.success)
      return result(false, "Bütçe satırındaki alanları kontrol et.");
    try {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase
        .from("developer_budget_items")
        .update({
          service_name: parsed.data.serviceName,
          monthly_cost_try: parsed.data.monthlyCostTry,
          service_url: parsed.data.serviceUrl,
          notes: parsed.data.notes,
          billing_day: parsed.data.billingDay,
          is_active: parsed.data.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", parsed.data.id);
      if (error) throw error;
      await writeDeveloperAuditLog({
        actor: admin,
        action: "budget_item_updated",
        metadata: { budgetItemId: parsed.data.id },
      });
      revalidateDeveloperPaths();
      return result(true, "Bütçe satırı güncellendi.");
    } catch {
      return result(false, "Bütçe satırı güncellenemedi.");
    }
  });
}

export async function deleteBudgetItemAction(
  id: string,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/budget", async (admin) => {
    if (!idSchema.safeParse(id).success)
      return result(false, "Geçersiz bütçe satırı.");
    try {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase
        .from("developer_budget_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await writeDeveloperAuditLog({
        actor: admin,
        action: "budget_item_deleted",
        metadata: { budgetItemId: id },
      });
      revalidateDeveloperPaths();
      return result(true, "Bütçe satırı silindi.");
    } catch {
      return result(false, "Bütçe satırı silinemedi.");
    }
  });
}

export async function grantUserSubscriptionAction(
  input: unknown,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/admin", async (admin) => {
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success)
      return result(false, "Plan ve süre bilgilerini kontrol et.");
    try {
      const endsAt = new Date(
        Date.now() + parsed.data.durationDays * 86_400_000,
      ).toISOString();
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("user_subscriptions").upsert(
        {
          user_id: parsed.data.userId,
          plan: parsed.data.plan,
          status: "active",
          provider: "admin",
          billing_cycle: null,
          recurring_price_amount: null,
          recurring_price_currency: null,
          recurring_monthly_try: null,
          revenue_price_updated_at: null,
          auto_renew_enabled: false,
          renews_at: endsAt,
          ends_at: endsAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await writeDeveloperAuditLog({
        actor: admin,
        action: "subscription_granted",
        targetUserId: parsed.data.userId,
        metadata: {
          plan: parsed.data.plan,
          durationDays: parsed.data.durationDays,
        },
      });
      revalidateDeveloperPaths();
      return result(
        true,
        `${parsed.data.plan} planı ${parsed.data.durationDays} gün için tanımlandı.`,
      );
    } catch {
      return result(false, "Abonelik tanımlanamadı.");
    }
  });
}

export async function cancelUserSubscriptionAction(
  userId: string,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/admin", async (admin) => {
    if (!idSchema.safeParse(userId).success)
      return result(false, "Geçersiz kullanıcı.");
    try {
      const storeCancelled = await cancelGooglePlaySubscription(userId);
      if (!storeCancelled) {
        const supabase = createSupabaseAdminClient();
        const { error } = await supabase.from("user_subscriptions").upsert(
          {
            user_id: userId,
            plan: "free",
            status: "free",
            provider: "admin",
            billing_cycle: null,
            recurring_price_amount: null,
            recurring_price_currency: null,
            recurring_monthly_try: null,
            revenue_price_updated_at: null,
            auto_renew_enabled: false,
            ends_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
      }
      await writeDeveloperAuditLog({
        actor: admin,
        action: "subscription_cancelled",
        targetUserId: userId,
        metadata: { storeCancelled },
      });
      revalidateDeveloperPaths();
      return result(
        true,
        storeCancelled
          ? "Google Play yenilemesi iptal edildi; erişim mevcut dönem sonuna kadar sürer."
          : "Manuel abonelik erişimi kaldırıldı.",
      );
    } catch {
      return result(false, "Abonelik iptal edilemedi.");
    }
  });
}

export async function addUserCardAction(
  input: unknown,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/admin", async (admin) => {
    const parsed = cardSchema.safeParse(input);
    if (!parsed.success)
      return result(false, "Kart ve kullanıcı bilgilerini kontrol et.");
    const card = VOCABULARY_CARDS.find(
      (item) =>
        item.sourceKey === parsed.data.sourceKey ||
        item.id === parsed.data.sourceKey,
    );
    if (!card)
      return result(false, "Bu source key ile katalog kartı bulunamadı.");
    try {
      const learned = parsed.data.status === "learned";
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("user_cards").upsert(
        {
          user_id: parsed.data.userId,
          card_source_key: card.sourceKey,
          status: parsed.data.status,
          correct_count: learned ? getTierRequirement(card.tier) : 0,
          learned_at: learned ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,card_source_key" },
      );
      if (error) throw error;
      await writeDeveloperAuditLog({
        actor: admin,
        action: "user_card_added",
        targetUserId: parsed.data.userId,
        metadata: { sourceKey: card.sourceKey, status: parsed.data.status },
      });
      revalidateDeveloperPaths();
      return result(
        true,
        learned
          ? "Kart öğrenilmiş olarak eklendi."
          : "Kart öğrenilecekler listesine eklendi.",
      );
    } catch {
      return result(false, "Kart eklenemedi.");
    }
  });
}

export async function deleteUserWithConfirmationAction(
  input: unknown,
): Promise<DeveloperActionResult> {
  return withAdminAction("/developer/admin", async (admin) => {
    const parsed = deleteUserSchema.safeParse(input);
    if (
      !parsed.success ||
      parsed.data.confirmation !== `DELETE ${parsed.data.expectedEmail}`
    ) {
      return result(
        false,
        "Onay metni hedef kullanıcının e-postasıyla tam eşleşmeli.",
      );
    }
    try {
      if (parsed.data.userId === admin.id) {
        return result(
          false,
          "Kendi developer hesabını bu panelden silemezsin.",
        );
      }
      const supabase = createSupabaseAdminClient();
      const { data: targetData, error: targetError } =
        await supabase.auth.admin.getUserById(parsed.data.userId);
      const targetEmail = targetData.user?.email?.trim().toLowerCase();
      if (
        targetError ||
        !targetEmail ||
        targetEmail !== parsed.data.expectedEmail.toLowerCase()
      ) {
        return result(
          false,
          "Hedef kullanıcı ve onay e-postası tekrar doğrulanamadı.",
        );
      }
      const sessionClient = await createSupabaseServerClient();
      const {
        data: { user },
        error: userError,
      } = await sessionClient.auth.getUser();
      if (
        userError ||
        user?.id !== admin.id ||
        user.email?.toLowerCase() !== admin.email
      ) {
        return result(false, "Admin oturumu doğrulanamadı.");
      }
      const { error: passwordError } =
        await sessionClient.auth.signInWithPassword({
          email: admin.email,
          password: parsed.data.password,
        });
      if (passwordError)
        return result(false, "Supabase admin parolası doğrulanamadı.");

      await writeDeveloperAuditLog({
        actor: admin,
        action: "user_deletion_confirmed",
        targetUserId: parsed.data.userId,
        metadata: { targetEmail: parsed.data.expectedEmail },
      });
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        parsed.data.userId,
      );
      if (deleteError) throw deleteError;
      revalidateDeveloperPaths();
      return result(true, "Kullanıcı ve ilişkili verileri silindi.");
    } catch {
      return result(false, "Kullanıcı silinemedi.");
    }
  });
}
