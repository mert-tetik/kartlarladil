import { afterEach, describe, expect, it, vi } from "vitest";
import { installLearnImageReadinessGate } from "@/app/learn/components/learn-image-readiness-gate";

describe("Learn image readiness gate", () => {
  let cleanupGate: (() => void) | undefined;

  afterEach(() => {
    cleanupGate?.();
    cleanupGate = undefined;
    document.body.replaceChildren();
  });

  it("marks an image ready only after its selected source decodes", async () => {
    let finishDecode!: () => void;
    const decodePromise = new Promise<void>((resolve) => {
      finishDecode = resolve;
    });
    const image = document.createElement("img");
    image.src = "/quiz/bonus_img.webp";
    image.decode = vi.fn(() => decodePromise);
    Object.defineProperty(image, "complete", { configurable: true, value: true });
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 800 });

    cleanupGate = installLearnImageReadinessGate();
    document.body.append(image);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(image).not.toHaveAttribute("data-learn-image-ready");
    finishDecode();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(image).toHaveAttribute("data-learn-image-ready", "true");
  });

  it("leaves failed or unavailable images unmarked instead of substituting another image", async () => {
    const image = document.createElement("img");
    image.src = "/quiz/unavailable.webp";
    image.decode = vi.fn().mockRejectedValue(new Error("decode failed"));
    Object.defineProperty(image, "complete", { configurable: true, value: true });
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 0 });

    cleanupGate = installLearnImageReadinessGate();
    document.body.append(image);
    image.dispatchEvent(new Event("error"));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(image).not.toHaveAttribute("data-learn-image-ready");
    expect(image.getAttribute("src")).toBe("/quiz/unavailable.webp");
  });
});
