import type { NextRequest } from "next/server";

export const NATIVE_LAUNCH_REQUEST_HEADER = "x-foxiesdeck-native-launch";

/** Only mark the exact TWA start URL; never trust a client-supplied header. */
export function getSupabaseForwardedRequestHeaders(request: NextRequest): Headers {
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete(NATIVE_LAUNCH_REQUEST_HEADER);

  const { pathname, searchParams } = request.nextUrl;
  if (
    pathname === "/" &&
    searchParams.get("twa") === "1" &&
    searchParams.get("native") === "1"
  ) {
    forwardedHeaders.set(NATIVE_LAUNCH_REQUEST_HEADER, "1");
  }

  return forwardedHeaders;
}
