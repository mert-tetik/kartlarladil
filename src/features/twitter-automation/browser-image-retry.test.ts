import { describe, expect, it, vi } from "vitest";
import { BrowserImageRenderError, browserImageFailureCode, retryBrowserImageOperation } from "./browser-image-retry";

describe("retryBrowserImageOperation", () => {
  it("keeps the prepared content and succeeds when toPng fails twice before the third snapshot", async () => {
    const createContent = vi.fn().mockResolvedValue({ term: "wander" });
    const toPng = vi.fn()
      .mockRejectedValueOnce(new Error("canvas temporarily unavailable"))
      .mockRejectedValueOnce(new Error("canvas temporarily unavailable"))
      .mockResolvedValueOnce("data:image/png;base64,ok");
    const prepareSnapshot = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    const content = await createContent();

    const dataUrl = await retryBrowserImageOperation(() => toPng(content), {
      beforeAttempt: prepareSnapshot,
      failureCode: "browser_image_snapshot_failed",
      wait,
    });

    expect(dataUrl).toBe("data:image/png;base64,ok");
    expect(createContent).toHaveBeenCalledTimes(1);
    expect(toPng).toHaveBeenCalledTimes(3);
    expect(prepareSnapshot).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledWith(350);
    expect(wait).toHaveBeenCalledWith(900);
  });

  it("uses the dedicated snapshot code after every local snapshot attempt fails", async () => {
    await expect(retryBrowserImageOperation(
      vi.fn().mockRejectedValue(new Error("canvas temporarily unavailable")),
      { failureCode: "browser_image_snapshot_failed", wait: vi.fn().mockResolvedValue(undefined) },
    )).rejects.toEqual(expect.objectContaining<Partial<BrowserImageRenderError>>({
      code: "browser_image_snapshot_failed",
    }));
  });

  it("does not expose arbitrary browser exception text as an automation error code", () => {
    expect(browserImageFailureCode(new Error("sensitive provider response"))).toBe("browser_image_render_failed");
    expect(browserImageFailureCode(new Error("self_false_friends_generation_failed"), "browser_image_content_failed")).toBe("self_false_friends_generation_failed");
    expect(browserImageFailureCode(new BrowserImageRenderError("browser_self_image_unavailable"))).toBe("browser_self_image_unavailable");
  });
});
