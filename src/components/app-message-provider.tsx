"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppMessageTone = "success" | "error";

interface AppMessage {
  id: number;
  message: string;
  tone: AppMessageTone;
}

interface AppMessageContextValue {
  showMessage: (message: string, tone?: AppMessageTone, durationMs?: number) => void;
  hideMessage: () => void;
}

const AppMessageContext = createContext<AppMessageContextValue | null>(null);
const EMPTY_APP_MESSAGE_CONTEXT: AppMessageContextValue = {
  showMessage: () => undefined,
  hideMessage: () => undefined,
};

export function AppMessageProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<AppMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const nextIdRef = useRef(0);
  const messageRef = useRef<AppMessage | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (removeTimerRef.current !== null) {
      window.clearTimeout(removeTimerRef.current);
      removeTimerRef.current = null;
    }
  }, []);

  const hideMessage = useCallback(() => {
    clearTimers();
    setVisible(false);
    removeTimerRef.current = window.setTimeout(() => {
      messageRef.current = null;
      setMessage(null);
      removeTimerRef.current = null;
    }, 220);
  }, [clearTimers]);

  const showMessage = useCallback((text: string, tone: AppMessageTone = "success", durationMs = 3000) => {
    const trimmedMessage = text.trim();
    if (!trimmedMessage) return;

    clearTimers();
    const nextMessage: AppMessage = {
      id: nextIdRef.current + 1,
      message: trimmedMessage,
      tone,
    };
    nextIdRef.current = nextMessage.id;
    messageRef.current = nextMessage;
    setVisible(false);
    setMessage(nextMessage);

    window.requestAnimationFrame(() => {
      if (messageRef.current?.id === nextMessage.id) {
        setVisible(true);
      }
    });

    hideTimerRef.current = window.setTimeout(() => {
      if (messageRef.current?.id === nextMessage.id) {
        hideMessage();
      }
    }, durationMs);
  }, [clearTimers, hideMessage]);

  useEffect(() => clearTimers, [clearTimers]);

  const contextValue = useMemo(() => ({ showMessage, hideMessage }), [hideMessage, showMessage]);

  return (
    <AppMessageContext.Provider value={contextValue}>
      {children}
      {message ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex justify-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]" aria-live="polite">
          <div
            role={message.tone === "error" ? "alert" : "status"}
            data-app-message={message.tone}
            className={cn(
              "flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]",
              visible ? "translate-y-0 opacity-100" : "-translate-y-5 opacity-0",
              message.tone === "success" ? "bg-emerald-600" : "bg-red-600",
            )}
          >
            {message.tone === "success" ? <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /> : <CircleAlert className="size-5 shrink-0" aria-hidden="true" />}
            <span className="min-w-0 flex-1">{message.message}</span>
          </div>
        </div>
      ) : null}
    </AppMessageContext.Provider>
  );
}

export function useAppMessage() {
  const context = useContext(AppMessageContext);
  return context ?? EMPTY_APP_MESSAGE_CONTEXT;
}
