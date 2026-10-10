import { AuthRecoveryRedirect } from "@/features/auth/components/auth-recovery-redirect";
import { getSafeNextPath } from "@/features/auth/auth-redirects";

export const dynamic = "force-dynamic";

export default async function AuthRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const nextPath = getSafeNextPath(nextParam, "/account/update-password");

  return <AuthRecoveryRedirect nextPath={nextPath} />;
}
