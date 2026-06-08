import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath, getSearchParamValue } from "@/features/auth/auth-redirects";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kayıt ol | Kartlarla Dil",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(getSearchParamValue(params.next), DEFAULT_AUTH_REDIRECT);
  const user = await getCurrentAuthUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <AuthPageShell
      title="Kayıt ol"
      description="Öğrenmek istediğin dili ve seviyeyi seç; keşfet ekranını bu tercihle başlatalım."
      footer={
        <p>
          Zaten hesabın var mı?{" "}
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-slate-950">
            Giriş yap
          </Link>
        </p>
      }
    >
      <RegisterForm nextPath={nextPath} />
    </AuthPageShell>
  );
}
