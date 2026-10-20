"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

interface AppRenderErrorFallbackProps {
  error: Error & { digest?: string };
  title: string;
  description: string;
  retryLabel: string;
  reloadLabel: string;
  onRetry: () => void;
}

export function AppRenderErrorFallback({
  error,
  title,
  description,
  retryLabel,
  reloadLabel,
  onRetry,
}: AppRenderErrorFallbackProps) {
  useEffect(() => {
    try {
      console.error("[FoxiesDeck] A render error was contained by an application boundary.", {
        digest: error.digest,
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } catch {
      // Diagnostics must never turn a recoverable page error into another failure.
    }
  }, [error]);

  return (
    <main
      role="alert"
      style={{
        alignItems: "center",
        background: "#ffffff",
        boxSizing: "border-box",
        color: "#171717",
        display: "flex",
        fontFamily: "system-ui, sans-serif",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "24px",
        width: "100%",
      }}
    >
      <section style={{ maxWidth: 420, textAlign: "center", width: "100%" }}>
        <div
          aria-hidden="true"
          style={{
            alignItems: "center",
            background: "#f1f1f1",
            borderRadius: 999,
            color: "#5b5b5b",
            display: "flex",
            height: 56,
            justifyContent: "center",
            margin: "0 auto 20px",
            width: 56,
          }}
        >
          <TriangleAlert size={28} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, margin: 0 }}>{title}</h1>
        <p style={{ color: "#666666", fontSize: 15, lineHeight: 1.6, margin: "12px 0 0" }}>
          {description}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 28 }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              alignItems: "center",
              background: "#171717",
              border: "1px solid #171717",
              borderRadius: 8,
              color: "#ffffff",
              cursor: "pointer",
              display: "inline-flex",
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              gap: 8,
              justifyContent: "center",
              minHeight: 44,
              padding: "0 16px",
            }}
          >
            {retryLabel}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              alignItems: "center",
              background: "#ffffff",
              border: "1px solid #d6d6d6",
              borderRadius: 8,
              color: "#171717",
              cursor: "pointer",
              display: "inline-flex",
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              gap: 8,
              justifyContent: "center",
              minHeight: 44,
              padding: "0 16px",
            }}
          >
            <RefreshCw aria-hidden="true" size={15} />
            {reloadLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
