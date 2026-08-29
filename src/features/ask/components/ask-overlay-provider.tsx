"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  setMobileNavbarBackOverride,
  subscribeMobileNavbarBackRequest,
} from "@/components/mobile-navbar-back";
import { useT } from "@/i18n/locale-provider";
import { useAuthSession } from "@/features/auth/auth-client";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode } from "@/types/domain";
import { AskChatPanel } from "@/features/ask/components/ask-chat-panel";

const ASK_OVERLAY_ANIMATION_MS = 320;

type AskOverlayPhase = "closed" | "opening" | "open" | "closing";

export interface AskOverlayRequest {
  contextLanguage?: LanguageCode;
  initialTerm?: string;
}

interface AskOverlayContextValue {
  openAsk: (request: AskOverlayRequest) => void;
  closeAsk: () => void;
}

const AskOverlayContext = createContext<AskOverlayContextValue | null>(null);

export function AskOverlayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const [phase, setPhase] = useState<AskOverlayPhase>("closed");
  const [request, setRequest] = useState<AskOverlayRequest | null>(null);

  const openAsk = useCallback((nextRequest: AskOverlayRequest) => {
    setRequest({
      contextLanguage: nextRequest.contextLanguage,
      initialTerm: nextRequest.initialTerm?.trim() ?? "",
    });
    setPhase((current) => (current === "closed" || current === "closing" ? "opening" : current));
  }, []);

  const closeAsk = useCallback(() => {
    setPhase((current) => (current === "open" || current === "opening" ? "closing" : current));
  }, []);

  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    closeAsk();
  }, [closeAsk, pathname]);

  useEffect(() => subscribeMobileNavbarBackRequest(closeAsk), [closeAsk]);

  useEffect(() => {
    if (phase !== "opening") return;

    const frameId = window.requestAnimationFrame(() => setPhase("open"));
    return () => window.cancelAnimationFrame(frameId);
  }, [phase]);

  useEffect(() => {
    if (phase !== "closing") return;

    const timer = window.setTimeout(() => {
      setPhase("closed");
      setRequest(null);
    }, ASK_OVERLAY_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const visible = phase !== "closed";
    setMobileNavbarBackOverride(visible);

    if (!visible) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "closed") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAsk();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAsk, phase]);

  const contextValue = useMemo(() => ({ openAsk, closeAsk }), [closeAsk, openAsk]);

  return (
    <AskOverlayContext.Provider value={contextValue}>
      {children}
      {phase !== "closed" && request && typeof document !== "undefined"
          ? createPortal(
            <AskOverlay
              phase={phase}
              request={request}
              nativeLocale={user?.profile.preferredUiLocale ?? undefined}
              fallbackLearningLanguage={user?.profile.preferredLanguageCode ?? undefined}
              onClose={closeAsk}
            />,
            document.body,
          )
        : null}
    </AskOverlayContext.Provider>
  );
}

export function useAskOverlay() {
  const context = useContext(AskOverlayContext);
  return context ?? {
    openAsk: () => undefined,
    closeAsk: () => undefined,
  };
}

function AskOverlay({
  phase,
  request,
  nativeLocale,
  fallbackLearningLanguage,
  onClose,
}: {
  phase: Exclude<AskOverlayPhase, "closed">;
  request: AskOverlayRequest;
  nativeLocale?: LocaleCode;
  fallbackLearningLanguage?: LanguageCode;
  onClose: () => void;
}) {
  const t = useT();
  const isOpen = phase === "open";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("page.ask.title")}
      data-ask-overlay
      data-state={phase}
      className={cn(
        "fixed inset-x-0 bottom-0 top-[var(--app-header-height)] z-[70] overflow-hidden transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
      )}
    >
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="absolute inset-0 z-0 w-full bg-black/70"
      />
      <div className="relative z-10 mx-auto h-full w-full max-w-7xl px-0 lg:px-8">
        <AskChatPanel
          key={`${request.contextLanguage ?? "auto"}:${request.initialTerm ?? ""}`}
          contextLanguage={request.contextLanguage}
          initialTerm={request.initialTerm ?? ""}
          nativeLocale={nativeLocale}
          fallbackLearningLanguage={fallbackLearningLanguage}
          className="max-w-none rounded-none border-x-0"
        />
      </div>
    </div>
  );
}
