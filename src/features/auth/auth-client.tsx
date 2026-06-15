"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath } from "@/features/auth/auth-redirects";

interface AuthSessionContextValue {
  user: AuthShellUser | null;
}

interface RequireAuthActionOptions {
  nextPath?: string;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  user: initialUser,
  children,
}: {
  user: AuthShellUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const client = useMemo(() => (hasSupabaseBrowserConfig() ? createSupabaseBrowserClient() : null), []);

  useEffect(() => {
    if (!client) {
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  return <AuthSessionContext.Provider value={{ user }}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}

export function useRequireAuthAction() {
  const { user } = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    <T,>(action: () => T, options?: RequireAuthActionOptions): T | undefined => {
      if (user) {
        return action();
      }

      const nextPath = getSafeNextPath(options?.nextPath ?? getCurrentClientPath(pathname), DEFAULT_AUTH_REDIRECT);
      router.push(`/register?next=${encodeURIComponent(nextPath)}`);

      return undefined;
    },
    [pathname, router, user],
  );
}

function getCurrentClientPath(pathname: string) {
  if (typeof window === "undefined") {
    return pathname || DEFAULT_AUTH_REDIRECT;
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
