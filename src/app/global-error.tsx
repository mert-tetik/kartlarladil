"use client";

import { AppRenderErrorFallback } from "@/components/app-render-error-fallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AppRenderErrorFallback
          error={error}
          title="Page couldn’t load"
          description="Something went wrong while loading this page."
          retryLabel="Try again"
          reloadLabel="Reload page"
          onRetry={reset}
        />
      </body>
    </html>
  );
}
