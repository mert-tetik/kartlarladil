import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getSupabaseForwardedRequestHeaders,
  NATIVE_LAUNCH_REQUEST_HEADER,
} from "@/lib/supabase/native-launch-request";

describe("native launch request marker", () => {
  it("marks only the exact TWA root start URL", () => {
    const request = new NextRequest("https://foxiesdeck.com/?twa=1&native=1");
    expect(getSupabaseForwardedRequestHeaders(request).get(NATIVE_LAUNCH_REQUEST_HEADER)).toBe("1");

    const websiteRequest = new NextRequest("https://foxiesdeck.com/?native=1");
    expect(getSupabaseForwardedRequestHeaders(websiteRequest).has(NATIVE_LAUNCH_REQUEST_HEADER)).toBe(false);

    const subrouteRequest = new NextRequest("https://foxiesdeck.com/learn?twa=1&native=1");
    expect(getSupabaseForwardedRequestHeaders(subrouteRequest).has(NATIVE_LAUNCH_REQUEST_HEADER)).toBe(false);
  });

  it("does not trust a caller-supplied marker", () => {
    const request = new NextRequest("https://foxiesdeck.com/", {
      headers: { [NATIVE_LAUNCH_REQUEST_HEADER]: "1" },
    });
    expect(getSupabaseForwardedRequestHeaders(request).has(NATIVE_LAUNCH_REQUEST_HEADER)).toBe(false);
  });
});
