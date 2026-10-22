"use client";

import { useEffect, useRef, useState } from "react";

export function FittedSingleLineText({ children, className }: { children: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) {
      return;
    }

    const fitText = () => {
      const availableWidth = container.clientWidth;
      const textWidth = text.scrollWidth;

      setScale(availableWidth > 0 && textWidth > availableWidth ? availableWidth / textWidth : 1);
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
    <span className={`block w-full overflow-hidden ${className ?? ""}`} data-single-line-fit-container="" ref={containerRef}>
      <span
        className="inline-block origin-center whitespace-nowrap"
        data-single-line-fit-content=""
        ref={textRef}
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </span>
    </span>
  );
}
