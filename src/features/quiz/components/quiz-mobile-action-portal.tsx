"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export function QuizMobileActionPortal({
  children,
  withinTransition = false,
  mobileOnly = false,
}: {
  children: ReactNode;
  withinTransition?: boolean;
  mobileOnly?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    setIsMobileViewport(window.innerWidth < 1024);
    setReady(true);
  }, []);

  if (
    !ready ||
    !document.querySelector("[data-learn-page]") ||
    document.querySelector("[data-normal-test]")
  ) {
    return children;
  }

  if (mobileOnly && !isMobileViewport) {
    return children;
  }

  if (withinTransition) {
    const transitionHost = document.querySelector<HTMLElement>(
      "[data-quiz-transition-action-host]",
    );

    return transitionHost ? createPortal(children, transitionHost) : children;
  }

  return createPortal(children, document.body);
}
