"use client";

import { useEffect, type RefObject } from "react";

const MIN_TEXTAREA_HEIGHT = 36;
const MAX_TEXTAREA_HEIGHT = 120;

export function useAutoResizeTextarea(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  enabled = true,
) {
  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !enabled) {
      return;
    }

    textarea.style.height = "auto";
    const contentHeight = Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT);
    const nextHeight = Math.min(contentHeight, MAX_TEXTAREA_HEIGHT);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = contentHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [enabled, textareaRef, value]);
}
