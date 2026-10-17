import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => supabaseMock,
}));

import { getSocialAnalyticsData, getSocialAnalyticsPosts } from "./social-analytics-data";

const originalApiKey = process.env.UPLOAD_POST_API_KEY;

function queryBuilder<T>(result: { data: T; error: null }) {
  const builder = {
    select: vi.fn(),
    order: vi.fn(),
    returns: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.returns.mockResolvedValue(result);
  return builder;
}

function singleQueryBuilder<T>(result: { data: T; error: null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.UPLOAD_POST_API_KEY;
  else process.env.UPLOAD_POST_API_KEY = originalApiKey;
});

describe("getSocialAnalyticsData", () => {
  it("returns a configured state without making provider calls when the API key is missing", async () => {
    delete process.env.UPLOAD_POST_API_KEY;
    const socials = queryBuilder({
      data: [{ id: 1, "Social Media": "Instagram", "Account Name": "@foxiesdeck", "upload-post profile username": "foxies", description: null }],
      error: null,
    });
    const connections = queryBuilder({ data: [], error: null });
    supabaseMock.from.mockImplementation((table: string) => table === "social_medias" ? socials : connections);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSocialAnalyticsData();

    expect(result.configured).toBe(false);
    expect(result.accounts[0]?.status).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("combines Supabase accounts with grouped Upload-Post analytics and media", async () => {
    process.env.UPLOAD_POST_API_KEY = "test-api-key";
    const socials = queryBuilder({
      data: [
        { id: 1, "Social Media": "Instagram", "Account Name": "@foxiesdeck", "upload-post profile username": "foxies", description: null },
        { id: 2, "Social Media": "Facebook", "Account Name": "FoxiesDeck Page", "upload-post profile username": "foxies", description: "Main page" },
      ],
      error: null,
    });
    const connections = queryBuilder({
      data: [{ social_media_id: 2, provider: "meta", provider_account_id: "page-123", status: "connected", last_validated_at: "2026-10-13T10:00:00.000Z", last_error_message: null }],
      error: null,
    });
    supabaseMock.from.mockImplementation((table: string) => table === "social_medias" ? socials : connections);

    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/uploadposts/users/")) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              social_accounts: {
                instagram: { handle: "foxiesdeck" },
                facebook: { handle: "foxiesdeckturkiye" },
              },
            },
          }),
        };
      }
      if (input.includes("/analytics/")) {
        return {
          ok: true,
          json: async () => ({
            instagram: { followers: 100, reach: 20, views: 30, likes: 5, comments: 2, shares: 1, metric_type: "reach", reach_timeseries: [{ date: "2026-10-12", value: 20 }] },
            facebook: { followers: 200, reach: 40, impressions: 50, likes: 4, comments: 1, shares: 1, metric_type: "reach", reach_timeseries: [{ date: "2026-10-12", value: 40 }] },
          }),
        };
      }
      return { ok: true, json: async () => ({ media: [{ id: `${input.includes("instagram") ? "ig" : "fb"}-1`, caption: "Test post", permalink: "https://example.com/post", timestamp: "2026-10-12T12:00:00.000Z" }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSocialAnalyticsData(7);

    expect(result.configured).toBe(true);
    expect(result.days).toBe(7);
    expect(result.summary).toMatchObject({ totalAccounts: 2, liveAccounts: 2, totalFollowers: 300, totalReach: 60, totalViews: 80, totalEngagement: 14 });
    expect(result.exposureSeries).toEqual([{ date: "2026-10-12", value: 60 }]);
    expect(result.accounts[1]?.directConnectionStatus).toBe("connected");
    expect(result.accounts[0]?.profileHandle).toBe("foxiesdeck");
    expect(result.accounts[1]?.profileHandle).toBe("foxiesdeckturkiye");
    expect(result.accounts[1]?.recentPosts).toHaveLength(0);
    const analyticsRequest = String(fetchMock.mock.calls.find(([input]) => input.includes("/analytics/"))?.[0]);
    expect(analyticsRequest).toContain("page_id=page-123");
    expect(analyticsRequest).toContain("platforms=instagram%2Cfacebook");
  });

  it("resolves a Facebook Page ID from the Upload-Post profile when no direct connection row exists", async () => {
    process.env.UPLOAD_POST_API_KEY = "test-api-key";
    const socials = queryBuilder({
      data: [{ id: 2, "Social Media": "Facebook", "Account Name": "FoxiesDeck Türkiye", "upload-post profile username": "FoxiesDeckTürkiye", description: null }],
      error: null,
    });
    const connections = queryBuilder({ data: [], error: null });
    supabaseMock.from.mockImplementation((table: string) => table === "social_medias" ? socials : connections);

    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/uploadposts/users/")) {
        if (decodeURIComponent(input).includes("FoxiesDeckTürkiye")) return { ok: false, json: async () => ({ success: false, message: "Profile not found" }) };
        return { ok: true, json: async () => ({ facebook_page_id: "page-from-profile", facebook_page_name: "FoxiesDeck Turkiye", profile: { social_accounts: { facebook: { handle: "foxiesdeckturkiye" } } } }) };
      }
      if (input.includes("/uploadposts/facebook/pages")) {
        return { ok: true, json: async () => ({ success: true, pages: [{ page_id: "page-from-upload-post", page_name: "FoxiesDeck Türkiye", profile: "foxies" }] }) };
      }
      return { ok: true, json: async () => ({ facebook: { followers: 12, reach: 8, views: 20, likes: 2, comments: 1, shares: 1, metric_type: "reach" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSocialAnalyticsData();

    expect(result.accounts[0]).toMatchObject({ status: "live", profileHandle: "foxiesdeckturkiye", metrics: { followers: 12 } });
    const analyticsRequest = String(fetchMock.mock.calls.find(([input]) => input.includes("/analytics/"))?.[0]);
    expect(analyticsRequest).toContain("platforms=facebook");
    expect(analyticsRequest).toContain("page_id=page-from-profile");
    expect(analyticsRequest).toContain("/analytics/FoxiesDeckTurkiye?");
  });

  it("loads a paginated post list and enriches each post with native post metrics", async () => {
    process.env.UPLOAD_POST_API_KEY = "test-api-key";
    const social = singleQueryBuilder({
      data: { id: 1, "Social Media": "Instagram", "Account Name": "@foxiesdeck", "upload-post profile username": "foxies", description: null },
      error: null,
    });
    supabaseMock.from.mockReturnValue(social);
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/uploadposts/post-analytics")) {
        return { ok: true, json: async () => ({ platforms: { instagram: { post_metrics: { views: 120, likes: 12, comments: 3, shares: 2 } } } }) };
      }
      return { ok: true, json: async () => ({ media: [{ id: "post-1", caption: "A post", media_url: "https://cdn.example/post.jpg", timestamp: "2026-10-13T10:00:00.000Z" }], pagination: { has_more: true, next_cursor: "cursor-2" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSocialAnalyticsPosts(1, "cursor-1", 12);

    expect(result).toMatchObject({ accountId: 1, hasMore: true, nextCursor: "cursor-2" });
    expect(result.posts[0]).toMatchObject({ id: "post-1", mediaUrl: "https://cdn.example/post.jpg", stats: { views: 120, likes: 12, comments: 3, shares: 2 } });
    const mediaRequest = String(fetchMock.mock.calls.find(([input]) => input.includes("/uploadposts/media"))?.[0]);
    expect(mediaRequest).toContain("cursor=cursor-1");
  });

  it("loads Pinterest pins from provider-compatible media fields", async () => {
    process.env.UPLOAD_POST_API_KEY = "test-api-key";
    const social = singleQueryBuilder({
      data: { id: 7, "Social Media": "Pinterest", "Account Name": "@foxiesdeck", "upload-post profile username": "FoxiesDeckAllLanguages", description: null },
      error: null,
    });
    supabaseMock.from.mockReturnValue(social);
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/uploadposts/post-analytics")) {
        return { ok: true, json: async () => ({ platforms: { pinterest: { post_metrics: { impressions: 80, saves: 6, pin_clicks: 3, outbound_clicks: 2 } } } }) };
      }
      return { ok: true, json: async () => ({ data: [{ pin_id: "pin-1", title: "Pinterest pin", image_url: "https://cdn.example/pin.jpg", post_url: "https://pinterest.com/pin/pin-1", published_at: "2026-10-13T10:00:00.000Z" }], pagination: { has_more: false } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSocialAnalyticsPosts(7, undefined, 12);

    expect(result).toMatchObject({ accountId: 7, hasMore: false, nextCursor: null });
    expect(result.posts[0]).toMatchObject({ id: "pin-1", caption: "Pinterest pin", mediaUrl: "https://cdn.example/pin.jpg", permalink: "https://pinterest.com/pin/pin-1" });
  });
});
