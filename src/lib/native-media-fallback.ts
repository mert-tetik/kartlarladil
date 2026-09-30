export const NATIVE_MEDIA_FALLBACK_QUERY = "native-media-fallback";

export function getNativeMediaFallbackSource(source: string): string {
  if (typeof window === "undefined") {
    return source;
  }

  const url = new URL(source, window.location.origin);
  url.searchParams.set(NATIVE_MEDIA_FALLBACK_QUERY, "1");
  return url.toString();
}

export function isNativeMediaFallbackSource(source: string): boolean {
  try {
    return new URL(source, "https://foxiesdeck.com").searchParams.has(NATIVE_MEDIA_FALLBACK_QUERY);
  } catch {
    return false;
  }
}
