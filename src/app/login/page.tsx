import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath, getSearchParamValue } from "@/features/auth/auth-redirects";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giriş yap | Kartlarla Dil",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(getSearchParamValue(params.next), DEFAULT_AUTH_REDIRECT);
  const message = getSearchParamValue(params.message);
  const user = await getCurrentAuthUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <AuthPageShell
      title="Giriş yap"
      description="Kart hazneni, öğrenme ilerlemeni ve hesap ayarlarını güvenli oturumla yönet."
      footer={
        <p>
          Hesabın yok mu?{" "}
          <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-slate-950">
            Kayıt ol
          </Link>
        </p>
      }
    >
      <LoginForm nextPath={nextPath} message={message} />
    </AuthPageShell>
  );
}
