import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createNonAiSocialImage } from "./non-ai-social-image";

describe("createNonAiSocialImage", () => {
  it("produces a word-of-the-day image with content", async () => {
    const image = await createNonAiSocialImage({ language: "en", nativeLanguage: "tr", tier: "A1", mode: "word-of-the-day" });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.dataUrl.length).toBeGreaterThan(10_000);
    expect(image.caption).toContain("WORD OF THE DAY");
    const buffer = Buffer.from(image.dataUrl.split(",")[1]!, "base64");
    fs.writeFileSync(path.join(process.cwd(), "tmp/non-ai-wotd.png"), buffer);
  });

  it("produces a word-of-the-day-poster image with content", async () => {
    const image = await createNonAiSocialImage({ language: "en", nativeLanguage: "tr", tier: "A1", mode: "word-of-the-day-poster" });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.dataUrl.length).toBeGreaterThan(10_000);
    const buffer = Buffer.from(image.dataUrl.split(",")[1]!, "base64");
    fs.writeFileSync(path.join(process.cwd(), "tmp/non-ai-wotd-poster.png"), buffer);
  });
});