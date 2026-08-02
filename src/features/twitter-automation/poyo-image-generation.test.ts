import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePoyoImageEdit } from "@/features/twitter-automation/poyo-image-generation";

const originalFetch = global.fetch;

describe("PoYo GPT Image 2 image editing", () => {
  beforeEach(() => {
    vi.stubEnv("POYO_API_KEY", "test-poyo-key");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("uploads all three brand references and submits a low 1K edit request", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/api/common/upload/base64")) {
        const body = JSON.parse(init?.body as string) as { file_name: string };
        const fileName = body.file_name.endsWith("mascot.webp") ? "mascot.webp"
          : body.file_name.endsWith("wordmark.png") ? "wordmark.png"
            : "logo.webp";
        return Response.json({ data: { file_url: `https://poyo.test/${fileName}` } });
      }
      if (input.endsWith("/api/generate/submit")) return Response.json({ data: { task_id: "image-task-1" } });
      if (input.endsWith("/api/generate/status/image-task-1")) {
        return Response.json({ data: {
          status: "finished",
          files: [{ file_type: "image", file_url: "https://poyo.test/result.webp" }],
        } });
      }
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } });
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await generatePoyoImageEdit({ prompt: "Create a FoxiesDeck card", size: "1:1" });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    const request = JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string);
    expect(request).toEqual({
      model: "gpt-image-2-edit",
      input: {
        prompt: "Create a FoxiesDeck card",
        image_urls: [
          "https://poyo.test/mascot.webp",
          "https://poyo.test/wordmark.png",
          "https://poyo.test/logo.webp",
        ],
        quality: "low",
        size: "1:1",
        resolution: "1K",
      },
    });
    expect(result.dataUrl).toBe("data:image/webp;base64,AQID");
  });

  it("fails explicitly instead of falling back when the PoYo key is missing", async () => {
    vi.stubEnv("POYO_API_KEY", "");

    await expect(generatePoyoImageEdit({ prompt: "Create a FoxiesDeck card", size: "2:3" }))
      .rejects.toMatchObject({ code: "poyo_not_configured" });
  });

  it("surfaces a failed PoYo task instead of attempting another image provider", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/common/upload/base64")) {
        return Response.json({ data: { file_url: "https://poyo.test/reference.webp" } });
      }
      if (input.endsWith("/api/generate/submit")) return Response.json({ data: { task_id: "failed-task" } });
      if (input.endsWith("/api/generate/status/failed-task")) {
        return Response.json({ data: { status: "failed", files: [] } });
      }
      throw new Error(`Unexpected request: ${input}`);
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(generatePoyoImageEdit({ prompt: "Create a FoxiesDeck card", size: "1:1" }))
      .rejects.toMatchObject({ code: "poyo_image_generation_failed" });
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("https://api.poyo.ai/"))).toBe(true);
  });

  it("times out an unfinished PoYo task with an explicit retryable error", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/common/upload/base64")) {
        return Response.json({ data: { file_url: "https://poyo.test/reference.webp" } });
      }
      if (input.endsWith("/api/generate/submit")) return Response.json({ data: { task_id: "slow-task" } });
      if (input.endsWith("/api/generate/status/slow-task")) {
        return Response.json({ data: { status: "running", files: [] } });
      }
      throw new Error(`Unexpected request: ${input}`);
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(generatePoyoImageEdit({
      prompt: "Create a FoxiesDeck card",
      size: "1:1",
      timeoutMs: 0,
    })).rejects.toMatchObject({ code: "poyo_image_timeout" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
