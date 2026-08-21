import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createSignedUrlMock, fromMock, outputMaybeSingleMock, runMaybeSingleMock, storageFromMock } = vi.hoisted(() => ({
  createSignedUrlMock: vi.fn(),
  fromMock: vi.fn(),
  outputMaybeSingleMock: vi.fn(),
  runMaybeSingleMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
  hasSocialStudioAutomationSession: () => true,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock,
    storage: { from: storageFromMock },
  }),
}));

import { GET } from "./route";

const OUTPUT_ID = "7d13ccca-d537-4a5a-9a08-20df9c391007";
const RUN_ID = "8d13ccca-d537-4a5a-9a08-20df9c391007";

function mockOutputAndOwner(output: Record<string, unknown>) {
  outputMaybeSingleMock.mockResolvedValue({ data: output, error: null });
  runMaybeSingleMock.mockResolvedValue({ data: { id: RUN_ID }, error: null });
  const runOwnerEq = vi.fn(() => ({ maybeSingle: runMaybeSingleMock }));
  const runIdEq = vi.fn(() => ({ eq: runOwnerEq }));
  fromMock.mockImplementation((table: string) => {
    if (table === "social_content_automation_outputs") {
      return { select: () => ({ eq: () => ({ maybeSingle: outputMaybeSingleMock }) }) };
    }
    if (table === "social_content_automation_runs") {
      return { select: () => ({ eq: runIdEq }) };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("automation browser video media source", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a fresh signed source URL only for the owned staged music-image output", async () => {
    const mediaPath = `automation/${OUTPUT_ID}.webp`;
    mockOutputAndOwner({
      id: OUTPUT_ID,
      run_id: RUN_ID,
      generator: "music-ai-mini-quiz",
      status: "awaiting_browser_video",
      media_path: mediaPath,
      media_type: "image",
    });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://assets.test/fresh-image.webp" }, error: null });
    storageFromMock.mockReturnValue({ createSignedUrl: createSignedUrlMock });

    const response = await GET(new NextRequest(`http://localhost/api/twitter-automation/automation-runs/media-source?outputId=${OUTPUT_ID}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sourceUrl: "https://assets.test/fresh-image.webp" });
    expect(createSignedUrlMock).toHaveBeenCalledWith(mediaPath, 3_600);
  });

  it("does not sign an output that has not reached the staged image checkpoint", async () => {
    mockOutputAndOwner({
      id: OUTPUT_ID,
      run_id: RUN_ID,
      generator: "music-self-mini-quiz",
      status: "awaiting_browser_image",
      media_path: null,
      media_type: null,
    });

    const response = await GET(new NextRequest(`http://localhost/api/twitter-automation/automation-runs/media-source?outputId=${OUTPUT_ID}`));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ errorCode: "browser_video_source_missing" });
    expect(storageFromMock).not.toHaveBeenCalled();
  });
});
