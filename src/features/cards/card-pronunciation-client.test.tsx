import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import type { CardPronunciationResult } from "@/features/cards/card-pronunciation";

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;

describe("card pronunciation client queue", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("keeps the fallback visible while waiting, then persists the generated pronunciation", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ status: "ready", pronunciation: "ekshılly" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/features/cards/card-pronunciation-client");
    const { result } = renderHook(() => client.useCardPronunciation(testCard));

    expect(result.current.pronunciation).toBe(testCard.pronunciation);
    expect(result.current.isLoading).toBe(false);

    act(() => {
      client.enqueueCardPronunciation(testCard.sourceKey);
    });

    expect(result.current.pronunciation).toBe(testCard.pronunciation);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current).toEqual({ pronunciation: "ekshılly", isLoading: false });
    });
    expect(window.localStorage.getItem("foxiesdeck:card-pronunciations:v1")).toContain("ekshılly");
  });

  it("keeps the fallback permanently when the generator reports a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ status: "failed" }) })));

    const client = await import("@/features/cards/card-pronunciation-client");
    const { result } = renderHook(() => client.useCardPronunciation(testCard));

    act(() => {
      client.enqueueCardPronunciation(testCard.sourceKey);
    });

    await waitFor(() => {
      expect(result.current).toEqual({ pronunciation: testCard.pronunciation, isLoading: false });
    });
    expect(window.localStorage.getItem("foxiesdeck:card-pronunciations:v1")).toContain('"failed"');
  });

  it("aborts a skipped card and does not let its response overwrite the fallback", async () => {
    let resolveRequest: ((value: { json: () => Promise<CardPronunciationResult> }) => void) | undefined;
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<{ json: () => Promise<CardPronunciationResult> }>((resolve) => {
        resolveRequest = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/features/cards/card-pronunciation-client");
    const { result } = renderHook(() => client.useCardPronunciation(testCard));

    act(() => {
      client.enqueueCardPronunciation(testCard.sourceKey, { preview: true });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      client.cancelCardPronunciation(testCard.sourceKey);
    });

    expect(requestSignal?.aborted).toBe(true);
    resolveRequest?.({
      json: async () => ({ status: "ready", pronunciation: "should-not-be-stored" }),
    });
    await waitFor(() => {
      expect(result.current).toEqual({
        pronunciation: testCard.pronunciation,
        isLoading: false,
      });
    });
    expect(window.localStorage.getItem("foxiesdeck:card-pronunciations:v1")).not.toContain(
      "should-not-be-stored",
    );
  });

  it("keeps two requests in flight and prioritizes a visible card over queued previews", async () => {
    const requests: Array<{
      sourceKey: string;
      resolve: () => void;
    }> = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { sourceKey: string };
      return new Promise<{ json: () => Promise<CardPronunciationResult> }>((resolve) => {
        requests.push({
          sourceKey: body.sourceKey,
          resolve: () => resolve({ json: async () => ({ status: "failed" }) }),
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = await import("@/features/cards/card-pronunciation-client");
    act(() => {
      client.enqueueCardPronunciation("preview-1", { preview: true });
      client.enqueueCardPronunciation("preview-2", { preview: true });
      client.enqueueCardPronunciation("preview-3", { preview: true });
      client.enqueueCardPronunciation("visible-card");
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(requests.map((request) => request.sourceKey)).toEqual(["preview-1", "preview-2"]);

    act(() => {
      requests[0].resolve();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(requests[2]?.sourceKey).toBe("visible-card");

    act(() => {
      requests[1].resolve();
      requests[2].resolve();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(requests[3]?.sourceKey).toBe("preview-3");
    act(() => {
      requests[3].resolve();
    });
  });
});
