"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseRecoveryBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";

export function AuthRecoveryRedirect({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const hasNavigatedRef = useRef(false);
  const client = useMemo(
    () => (hasSupabaseBrowserConfig() ? createSupabaseRecoveryBrowserClient() : null),
    [],
  );

  useEffect(() => {
    if (!client) return;

    const navigateToPasswordUpdate = () => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      router.replace(nextPath);
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigateToPasswordUpdate();
      }
    });

    void client.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigateToPasswordUpdate();
      }
    });

    return () => subscription.unsubscribe();
  }, [client, nextPath, router]);

  return null;
}
