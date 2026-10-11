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
    if (!client) {
      router.replace("/reset-password");
      return;
    }

    let isActive = true;

    const navigateToPasswordUpdate = () => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
      router.replace(nextPath);
    };

    const navigateToNewRecoveryRequest = () => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
      router.replace("/reset-password");
    };

    const consumeRecoveryHash = async () => {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (!accessToken || !refreshToken) {
        try {
          const {
            data: { session },
          } = await client.auth.getSession();

          if (!isActive) return;

          if (session) {
            navigateToPasswordUpdate();
          } else {
            navigateToNewRecoveryRequest();
          }
        } catch {
          navigateToNewRecoveryRequest();
        }
        return;
      }

      // Remove the sensitive fragment before awaiting any network/storage
      // work. setSession receives the tokens explicitly, so it does not need
      // the URL to remain intact.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

      try {
        const { data, error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isActive) return;

        if (error || !data.session) {
          navigateToNewRecoveryRequest();
          return;
        }

        navigateToPasswordUpdate();
      } catch {
        navigateToNewRecoveryRequest();
      }
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigateToPasswordUpdate();
      }
    });

    const fallbackTimer = window.setTimeout(navigateToNewRecoveryRequest, 12000);
    void consumeRecoveryHash();

    return () => {
      isActive = false;
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
      subscription.unsubscribe();
    };
  }, [client, nextPath, router]);

  return null;
}
