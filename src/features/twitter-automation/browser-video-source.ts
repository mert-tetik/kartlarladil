import type { AutomationScope } from "@/features/twitter-automation/automation-scope";

type BrowserMusicVideoOutput = {
  id: string;
  generator: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function safeFailureCode(value: unknown) {
  return typeof value === "string" && /^[a-z][a-z\d_]{2,119}$/u.test(value)
    ? value
    : "browser_video_source_url_failed";
}

/**
 * Always resolve a fresh signed URL right before a music-video render. The
 * progress poll deliberately omits most media URLs, so it must not be the
 * source of truth for a render-critical image asset.
 */
export async function resolveBrowserMusicVideoSourceUrl(
  output: BrowserMusicVideoOutput,
  scope: AutomationScope,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
) {
  if (!output.generator.startsWith("music-")) return null;

  const params = new URLSearchParams({ outputId: output.id });
  if (scope === "test") params.set("scope", "test");
  const response = await fetcher(`/api/twitter-automation/automation-runs/media-source?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  const payload = await response.json().catch(() => null) as { errorCode?: unknown; sourceUrl?: unknown } | null;
  if (!response.ok || typeof payload?.sourceUrl !== "string" || !payload.sourceUrl.startsWith("https://")) {
    throw new Error(safeFailureCode(payload?.errorCode));
  }
  return payload.sourceUrl;
}
