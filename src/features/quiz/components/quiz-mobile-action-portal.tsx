"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export function QuizMobileActionPortal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (
    !ready ||
    window.innerWidth >= 1024 ||
    !document.querySelector("[data-learn-page]") ||
    document.querySelector("[data-normal-test]")
  ) {
    return children;
  }

  return createPortal(children, document.body);
}
