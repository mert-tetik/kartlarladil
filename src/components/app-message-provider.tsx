"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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

const DEFAULT_APP_MESSAGE_DURATION_MS = 5000;
const APP_MESSAGE_TRANSITION_MS = 420;
const APP_MESSAGE_SWIPE_THRESHOLD_PX = 96;

interface AppMessageSwipeState {
  pointerId: number;
  startX: number;
}

export function AppMessageProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<AppMessage | null>(null);
  const [visible, setVisible] = useState(false);
  const nextIdRef = useRef(0);
  const messageRef = useRef<AppMessage | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);
  const swipeRef = useRef<AppMessageSwipeState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dismissOffset, setDismissOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const scheduleMessageRemoval = useCallback(() => {
    const messageId = messageRef.current?.id;
    if (messageId === undefined) return;

    removeTimerRef.current = window.setTimeout(() => {
      if (messageRef.current?.id !== messageId) return;

      messageRef.current = null;
      setMessage(null);
      removeTimerRef.current = null;
    }, APP_MESSAGE_TRANSITION_MS);
  }, []);

  const hideMessage = useCallback(() => {
    clearTimers();
    setDismissOffset(null);
    setDragOffset(0);
    setIsDragging(false);
    setVisible(false);
    scheduleMessageRemoval();
  }, [clearTimers, scheduleMessageRemoval]);

  const dismissMessageWithSwipe = useCallback((direction: -1 | 1) => {
    clearTimers();
    setIsDragging(false);
    setDragOffset(0);
    setDismissOffset(direction * (window.innerWidth + 320));
    setVisible(false);
    scheduleMessageRemoval();
  }, [clearTimers, scheduleMessageRemoval]);

  const showMessage = useCallback((text: string, tone: AppMessageTone = "success", durationMs = DEFAULT_APP_MESSAGE_DURATION_MS) => {
    const trimmedMessage = text.trim();
    if (!trimmedMessage) return;

    clearTimers();
    swipeRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
    setDismissOffset(null);
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

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    setDragOffset(event.clientX - swipe.startX);
  }, []);

  const finishPointerGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const offset = cancelled ? 0 : event.clientX - swipe.startX;
    swipeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!cancelled && Math.abs(offset) >= APP_MESSAGE_SWIPE_THRESHOLD_PX) {
      dismissMessageWithSwipe(offset < 0 ? -1 : 1);
      return;
    }

    setIsDragging(false);
    setDragOffset(0);
  }, [dismissMessageWithSwipe]);

  useEffect(() => clearTimers, [clearTimers]);

  const contextValue = useMemo(() => ({ showMessage, hideMessage }), [hideMessage, showMessage]);

  return (
    <AppMessageContext.Provider value={contextValue}>
      {children}
      {message ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex justify-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]" aria-live="polite">
          <div
            key={message.id}
            role={message.tone === "error" ? "alert" : "status"}
            data-app-message={message.tone}
            data-app-message-dragging={isDragging ? "true" : "false"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerGesture}
            onPointerCancel={(event) => finishPointerGesture(event, true)}
            className={cn(
              "pointer-events-auto flex w-full max-w-md touch-pan-y select-none items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.85,0,0.15,1)] will-change-[transform,opacity]",
              isDragging && "transition-none",
              visible ? "opacity-100" : "opacity-0",
              message.tone === "success" ? "bg-emerald-600" : "bg-red-600",
            )}
            style={{
              transform: dismissOffset !== null
                ? `translate3d(${dismissOffset}px, 0, 0)`
                : `translate3d(${dragOffset}px, ${visible ? "0" : "-1.25rem"}, 0)`,
            }}
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
