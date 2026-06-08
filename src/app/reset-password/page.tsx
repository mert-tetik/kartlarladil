import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şifreyi sıfırla | Kartlarla Dil",
};

export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="Şifreyi sıfırla"
      description="Email adresine yeni şifre belirleme bağlantısı gönder."
      footer={
        <p>
          Şifreni hatırladın mı?{" "}
          <Link href="/login" className="font-semibold text-slate-950">
            Giriş yap
          </Link>
        </p>
      }
    >
      <ResetPasswordForm />
    </AuthPageShell>
  );
}
