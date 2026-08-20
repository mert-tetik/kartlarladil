import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { fromMock, refreshRunMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  refreshRunMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
  hasSocialStudioAutomationSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  refreshAutomationRunStatus: refreshRunMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));

describe("automation output retry", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requeues a failed generation and clears its prior error", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "5d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "6d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          caption: null,
          media_path: null,
          media_paths: [],
          media_type: null,
          generator: "ai-mini-quiz",
          error_code: "image_generation_failed",
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "6d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "5d13ccca-d537-4a5a-9a08-20df9c391007", scope: "test" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "queued" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "queued",
      error_code: null,
    }));
    expect(refreshRunMock).toHaveBeenCalledWith("6d13ccca-d537-4a5a-9a08-20df9c391007");
  });

  it("restores an already-rendered failed output to the scheduling state", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "7d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "8d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          caption: "Hazır içerik",
          media_path: "automation/7d13ccca-d537-4a5a-9a08-20df9c391007.png",
          media_paths: [],
          media_type: "image",
          generator: "ai-mini-quiz",
          error_code: "automation_schedule_failed",
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "8d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "7d13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready_to_schedule" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "ready_to_schedule", error_code: null }));
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ media_path: null }));
  });

  it("puts a failed music video back into the browser video render stage without discarding its source image", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "9d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "1d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          caption: "Müzikli video açıklaması",
          media_path: "automation/9d13ccca-d537-4a5a-9a08-20df9c391007.png",
          media_paths: [],
          media_type: "image",
          generator: "music-ai-word-of-the-day",
          error_code: "browser_video_render_failed",
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "1d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "9d13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "awaiting_browser_video" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "awaiting_browser_video", error_code: null }));
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ media_path: null }));
  });

  it("keeps a partial AI image caption so its saved plan can render only the missing media", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "ad13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "bd13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          content_type: "image",
          caption: "Aynı görsel planının açıklaması",
          media_path: null,
          media_paths: [],
          media_type: null,
          generator: "ai-mini-quiz",
          error_code: "automation_media_store_failed",
          provider_task_id: null,
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "bd13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "ad13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "queued" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "queued", error_code: null }));
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ caption: null }));
  });

  it("resumes a failed avatar video from its existing provider task", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "cd13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "dd13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          content_type: "video",
          caption: "Aynı avatar videosunun açıklaması",
          media_path: "automation/cd13ccca-d537-4a5a-9a08-20df9c391007-preview.webp",
          media_paths: [],
          media_type: "image",
          generator: "ai-word-of-the-day-video",
          error_code: "video_status_failed",
          provider_task_id: "avatar-video-task-1",
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "dd13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "cd13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "generating_video" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "generating_video", error_code: null }));
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ provider_task_id: null }));
  });

  it("recovers an expired schedule lock without regenerating its ready text content", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "1d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "2d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "processing",
          content_type: "text",
          caption: "Hazır metin içeriği",
          media_path: null,
          media_paths: [],
          media_type: null,
          generator: "fun-post",
          error_code: null,
          provider_task_id: null,
          updated_at: new Date(Date.now() - 4 * 60_000).toISOString(),
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "2d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "1d13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready_to_schedule" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "ready_to_schedule", error_code: null }));
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ caption: null }));
  });

  it("does not take over a fresh processing lock", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "3d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "4d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "processing",
          content_type: "image",
          caption: null,
          media_path: null,
          media_paths: [],
          media_type: null,
          generator: "ai-mini-quiz",
          error_code: null,
          provider_task_id: null,
          updated_at: new Date().toISOString(),
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "4d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn();
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "3d13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
