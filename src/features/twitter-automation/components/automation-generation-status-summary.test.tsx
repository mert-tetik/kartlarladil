import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AutomationGenerationStatusSummary } from "./automation-generation-status-summary";

describe("AutomationGenerationStatusSummary", () => {
  it("counts successful, failed, and waiting generations and lists their modes", () => {
    render(<AutomationGenerationStatusSummary
      labelForGenerator={(generator) => ({
        "self-mini-quiz": "Mini Quiz (Self) görseli",
        "fun-post": "Fun FoxiesDeck postu",
        "music-ai-word-of-the-day": "Word of the Day videosu",
      })[generator] ?? generator}
      outputs={[
        { generator: "self-mini-quiz", status: "ready_to_schedule" },
        { generator: "self-mini-quiz", status: "scheduled" },
        { generator: "fun-post", status: "failed" },
        { generator: "music-ai-word-of-the-day", status: "awaiting_browser_video" },
        { generator: "self-mini-quiz", status: "queued" },
      ]}
    />);

    expect(screen.getByRole("button", { name: "Başarılı: 2 içerik" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Hatalı: 1 içerik" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bekleyen: 2 içerik" })).toBeVisible();
    expect(screen.getAllByRole("tooltip")[0]).toHaveTextContent("Mini Quiz (Self) görseli");
    expect(screen.getAllByRole("tooltip")[1]).toHaveTextContent("Fun FoxiesDeck postu");
    expect(screen.getAllByRole("tooltip")[2]).toHaveTextContent("Word of the Day videosu");
    expect(screen.getAllByRole("tooltip")[2]).toHaveTextContent("Mini Quiz (Self) görseli");
  });
});
