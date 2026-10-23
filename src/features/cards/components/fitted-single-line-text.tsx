"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const FIT_WIDTH_SAFETY_RATIO = 0.96;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function FittedSingleLineText({
  children,
  className,
  centered = false,
}: {
  children: string;
  className?: string;
  centered?: boolean;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) {
      return;
    }

    const fitText = () => {
      const availableWidth = container.clientWidth;
      const textWidth = text.scrollWidth;
      const safeWidth = availableWidth * FIT_WIDTH_SAFETY_RATIO;

      setScale(safeWidth > 0 && textWidth > safeWidth ? safeWidth / textWidth : 1);
    };

    fitText();
    void document.fonts?.ready.then(fitText);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(fitText);
    observer.observe(container);

    return () => observer.disconnect();
  }, [children]);

  return (
    <span
      className={`block w-full overflow-hidden ${className ?? ""}`}
      data-single-line-fit-centered={centered ? "" : undefined}
      data-single-line-fit-container=""
      ref={containerRef}
    >
      <span
        className="inline-block origin-center whitespace-nowrap"
        data-single-line-fit-content=""
        ref={textRef}
        style={{ transform: `${centered ? "translateX(-50%) " : ""}scale(${scale})` }}
      >
        {children}
      </span>
    </span>
  );
}
