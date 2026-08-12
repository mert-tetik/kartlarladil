import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { VOCABULARY_CARDS } from "@/data/cards";

const createPosterCard = vi.hoisted(() => vi.fn());

vi.mock("@/features/twitter-automation/social-studio-vocabulary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./social-studio-vocabulary")>();
  return { ...actual, createRandomSocialStudioWordOfTheDayPosterCard: createPosterCard };
});

import { createNonAiSocialImage } from "./non-ai-social-image";

function writeDebugImage(filename: string, dataUrl: string) {
  const outDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, filename), Buffer.from(dataUrl.split(",")[1]!, "base64"));
}

describe("createNonAiSocialImage", () => {
  beforeEach(() => {
    const card = VOCABULARY_CARDS.find((candidate) => candidate.language === "en" && candidate.tier === "A1" && candidate.termKind === "word");
    if (!card) throw new Error("Expected an English A1 card fixture");
    createPosterCard.mockResolvedValue(card);
  });

  it("produces a word-of-the-day image with content", async () => {
    const image = await createNonAiSocialImage({ language: "en", nativeLanguage: "tr", tier: "A1", mode: "word-of-the-day" });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.dataUrl.length).toBeGreaterThan(10_000);
    expect(image.caption.split("\n")).toHaveLength(5);
    expect(image.caption).toContain("Günün Kelimesi");
    expect(image.caption).toContain(" — ");
    expect(image.caption).toContain("#dilöğrenme #kelimeöğrenme #yabancıdil #dilpratiği #kelimehazinesi");
    writeDebugImage("non-ai-wotd.png", image.dataUrl);
  });

  it("produces a word-of-the-day-poster image with content", async () => {
    const image = await createNonAiSocialImage({ language: "en", nativeLanguage: "tr", tier: "A1", mode: "word-of-the-day-poster" });
    expect(image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(image.dataUrl.length).toBeGreaterThan(10_000);
    expect(createPosterCard).toHaveBeenCalledWith("en", "tr");
    writeDebugImage("non-ai-wotd-poster.png", image.dataUrl);
  });
});
