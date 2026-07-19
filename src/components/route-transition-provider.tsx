"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { beginNavigationIntent } from "@/lib/navigation-intent";
import { navigateWithRouteTransition } from "@/lib/route-transition";

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const interactiveElement = (event.target as Element | null)?.closest(
      "a[href], button, [role='button']",
    );
    if (!(interactiveElement instanceof HTMLElement)) return;
    if (interactiveElement instanceof HTMLButtonElement && interactiveElement.disabled) return;

    beginNavigationIntent();

    const anchor = interactiveElement.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target || anchor.hasAttribute("download")) return;

    const targetUrl = new URL(anchor.href, window.location.href);
    const currentUrl = new URL(window.location.href);
    const sameRoute = targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;
    if (targetUrl.origin !== currentUrl.origin || sameRoute) return;

    event.preventDefault();
    navigateWithRouteTransition(() => {
      router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
    });
  }

  return (
    <div className="contents" onClickCapture={handleClickCapture}>
      {children}
    </div>
  );
}
