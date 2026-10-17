"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { OfflineScreen, type OfflineVisualScenario } from "@/app/offline/offline-screen";

export function OfflineRouteOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  let visualScenario: OfflineVisualScenario | undefined;
  const isOfflinePath = pathname === "/offline" || pathname === "/~offline";

  if (pathname === "/visual-test-offline") visualScenario = "offline";

  useEffect(() => {
    if (!isOfflinePath) return;

    function handleOfflineReconnect(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin) return;
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-offline-shell-frame="true"]');
      if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;
      if (typeof event.data !== "object" || event.data === null) return;
      if ((event.data as Record<string, unknown>).type !== "foxiesdeck:offline-reconnected") return;

      const currentUrl = new URL(window.location.href);
      const requestedDestination = currentUrl.searchParams.get("returnTo");
      let targetUrl = new URL("/", currentUrl.origin);
      if (requestedDestination) {
        try {
          const candidate = new URL(requestedDestination, currentUrl.origin);
          if (candidate.origin === currentUrl.origin) targetUrl = candidate;
        } catch {
          // Invalid or external return paths fall back to the app home page.
        }
      }
      targetUrl.searchParams.set("twa", "1");
      targetUrl.searchParams.set("native", "1");
      router.replace(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
    }

    window.addEventListener("message", handleOfflineReconnect);
    return () => window.removeEventListener("message", handleOfflineReconnect);
  }, [isOfflinePath, router]);

  if (!isOfflinePath && pathname !== "/visual-test-offline") return null;

  return <OfflineScreen visualScenario={visualScenario} />;
}
