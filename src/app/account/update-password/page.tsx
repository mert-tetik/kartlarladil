import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";
import { requireAuthUser } from "@/features/auth/auth-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şifreyi güncelle | Kartlarla Dil",
};

export default async function UpdatePasswordPage() {
  await requireAuthUser("/account/update-password");

  return (
    <AuthPageShell
      title="Şifreyi güncelle"
      description="Reset linkinden sonra veya oturum içindeyken yeni şifreni belirle."
      footer={
        <p>
          Hesap ayarlarına dön:{" "}
          <Link href="/account/settings" className="font-semibold text-slate-950">
            Hesap ayarları
          </Link>
        </p>
      }
    >
      <UpdatePasswordForm />
    </AuthPageShell>
  );
}
