import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonClassName } from "@/components/ui/button";
import { AccountSettingsForm } from "@/features/auth/components/account-settings-form";
import { DeleteAccountForm } from "@/features/auth/components/delete-account-form";
import { requireAuthUser } from "@/features/auth/auth-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hesap ayarları | Kartlarla Dil",
};

export default async function AccountSettingsPage() {
  const user = await requireAuthUser("/account/settings");

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Hesap ayarları"
        description="Profil bilgilerini, şifre işlemlerini ve kalıcı hesap silme akışını buradan yönet."
        action={
          <Link href="/account/update-password" className={buttonClassName("secondary", "sm")}>
            Şifreyi güncelle
          </Link>
        }
      />

      <div className="mt-8 grid gap-6">
        <AccountSettingsForm user={user} />
        <DeleteAccountForm email={user.email} />
      </div>
    </section>
  );
}
