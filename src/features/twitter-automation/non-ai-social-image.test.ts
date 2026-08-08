import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createNonAiSocialImage } from "./non-ai-social-image";

function writeDebugImage(filename: string, dataUrl: string) {
  const outDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, filename), Buffer.from(dataUrl.split(",")[1]!, "base64"));
}

describe("createNonAiSocialImage", () => {
  it("produces a word-of-the-day image with content", async () => {
    const image = await createNonAiSocialImage({ language: "en", nativeLanguage: "tr", tier: "A1", mode: "word-of-the-day" });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.dataUrl.length).toBeGreaterThan(10_000);
    expect(image.caption).toContain("WORD OF THE DAY");
    writeDebugImage("non-ai-wotd.png", image.dataUrl);
  });

  it("produces a word-of-the-day-poster image with content", async () => {
    const image = await createNonAiSocialImage({ language: "en", nativeLanguage: "tr", tier: "A1", mode: "word-of-the-day-poster" });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.dataUrl.length).toBeGreaterThan(10_000);
    writeDebugImage("non-ai-wotd-poster.png", image.dataUrl);
  });
});