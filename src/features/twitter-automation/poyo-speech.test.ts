import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOXIESDECK_MASCOT_VOICE, generatePoyoSpeechDataUrls } from "@/features/twitter-automation/poyo-speech";

const originalFetch = global.fetch;

describe("PoYo speech segments", () => {
  beforeEach(() => {
    vi.stubEnv("POYO_API_KEY", "test-poyo-key");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("submits each fragment to the avatar TTS model in its requested language and returns audio data URLs", async () => {
    let taskIndex = 0;
    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/generate/submit")) {
        taskIndex += 1;
        return Response.json({ data: { task_id: `speech-${taskIndex}` } });
      }
      if (input.includes("/api/generate/status/speech-")) {
        const taskId = input.split("/").at(-1)!;
        return Response.json({ data: { status: "finished", files: [{ file_type: "audio", file_url: `https://poyo.test/${taskId}.mp3` }] } });
      }
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await generatePoyoSpeechDataUrls([
      { text: "angry", language: "en", voice: "Roger" },
      { text: "ve", language: "tr" },
    ]);

    const firstRequest = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondRequest = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(firstRequest.model).toBe("elevenlabs-tts-turbo-2-5");
    expect(firstRequest.input.language_code).toBe("en");
    expect(firstRequest.input.voice).toBe("Roger");
    expect(secondRequest.input.language_code).toBe("tr");
    expect(secondRequest.input.voice).toBe(FOXIESDECK_MASCOT_VOICE);
    expect(result).toEqual(["data:audio/mpeg;base64,AQID", "data:audio/mpeg;base64,AQID"]);
  });
});
