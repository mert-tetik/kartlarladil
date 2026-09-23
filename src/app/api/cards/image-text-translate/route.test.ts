import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());
const mockConsumeImageTextTranslation = vi.hoisted(() => vi.fn());
const mockGetImageTextTranslationUsage = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: mockCreate };
  },
}));

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

vi.mock("@/features/subscriptions/ai-usage-service", () => ({
  consumeImageTextTranslation: mockConsumeImageTextTranslation,
  getImageTextTranslationUsage: mockGetImageTextTranslationUsage,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
}));

import { POST } from "@/app/api/cards/image-text-translate/route";

const image = "data:image/png;base64,AAAA";

function makeResponse(sentences = [{ source: "Hello.", translation: "Merhaba.", separators: ["text"] }]) {
  return {
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify({ sentences }),
      }],
    }],
  };
}

function makeImageRequest() {
  return new Request("http://localhost/api/cards/image-text-translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "image",
      locale: "tr",
      targetLanguage: "en",
      answerQuestions: true,
      images: [image],
    }),
  });
}

describe("POST /api/cards/image-text-translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mockConsumeImageTextTranslation.mockResolvedValue(null);
    mockGetImageTextTranslationUsage.mockResolvedValue({
      used: 0,
      limit: 2,
      remaining: 2,
      canUse: true,
    });
    mockGetUserEntitlements.mockResolvedValue({ effectivePlan: "free" });
    mockCreate.mockResolvedValue(makeResponse());
  });

  it("sends image input and consumes usage only after a validated result", async () => {
    const response = await POST(makeImageRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sentences: [{ source: "Hello.", translation: "Merhaba." }],
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0]?.[0].input[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "input_image", image_url: image, detail: "high" }),
      ]),
    );
    expect(mockConsumeImageTextTranslation).toHaveBeenCalledWith("user-1");
  });

  it("does not consume a use when OpenAI fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("upstream unavailable"));

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ errorCode: "upstream_error" });
    expect(mockConsumeImageTextTranslation).not.toHaveBeenCalled();
  });

  it("returns a restriction without exposing an invalid successful result", async () => {
    mockConsumeImageTextTranslation.mockResolvedValueOnce("image_text_translate_limit");

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ errorCode: "image_text_translate_limit" });
  });

  it("fails before OpenAI when the authoritative usage snapshot is exhausted", async () => {
    mockGetImageTextTranslationUsage.mockResolvedValueOnce({
      used: 2,
      limit: 2,
      remaining: 0,
      canUse: false,
    });

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ errorCode: "image_text_translate_limit" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockConsumeImageTextTranslation).not.toHaveBeenCalled();
  });

  it("surfaces a stable usage-unavailable code when the quota RPC is unavailable", async () => {
    mockConsumeImageTextTranslation.mockRejectedValueOnce(new Error("PGRST202"));

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: "usage_unavailable" });
  });

  it("does not call OpenAI when the usage snapshot cannot be read", async () => {
    mockGetImageTextTranslationUsage.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(makeImageRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ errorCode: "usage_unavailable" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockConsumeImageTextTranslation).not.toHaveBeenCalled();
  });
});
