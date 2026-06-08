import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentAuthUser();

  return (
    <AuthSessionProvider user={user}>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <AppNavigation user={user} />
        <main className="pb-24 lg:pb-0">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
