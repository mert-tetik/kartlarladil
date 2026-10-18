import { describe, expect, it, vi } from "vitest";
import { awaitBrowserVideoOperation } from "./browser-video-operation";

describe("abortable browser video operations", () => {
  it("rejects a stalled encoder operation when its render is cancelled", async () => {
    const controller = new AbortController();
    const operation = new Promise<void>(() => undefined);
    const pending = awaitBrowserVideoOperation(operation, controller.signal);

    controller.abort();

    await expect(pending).rejects.toThrow("browser_video_render_timeout");
  });

  it("returns successful work and does not reject after it has finished", async () => {
    const controller = new AbortController();
    const result = await awaitBrowserVideoOperation(Promise.resolve("done"), controller.signal);

    controller.abort();

    expect(result).toBe("done");
  });

  it("does not start new browser work when its signal was already aborted", async () => {
    const controller = new AbortController();
    const operation = vi.fn(async () => "should not start");
    controller.abort();

    await expect(awaitBrowserVideoOperation(operation, controller.signal))
      .rejects.toThrow("browser_video_render_timeout");
    expect(operation).not.toHaveBeenCalled();
  });

  it("observes a signal aborted synchronously while starting the operation", async () => {
    const controller = new AbortController();
    const operation = () => {
      controller.abort();
      return new Promise<string>(() => undefined);
    };

    await expect(awaitBrowserVideoOperation(operation, controller.signal))
      .rejects.toThrow("browser_video_render_timeout");
  });
});
