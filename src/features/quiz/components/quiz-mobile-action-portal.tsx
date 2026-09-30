"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export function QuizMobileActionPortal({
  children,
  withinTransition = false,
}: {
  children: ReactNode;
  withinTransition?: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (
    !ready ||
    !document.querySelector("[data-learn-page]") ||
    document.querySelector("[data-normal-test]")
  ) {
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
