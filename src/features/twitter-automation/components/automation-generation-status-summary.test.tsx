import { fireEvent, render, screen } from "@testing-library/react";
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
        { error_code: "caption_generation_failed", generator: "fun-post", status: "failed" },
        { generator: "music-ai-word-of-the-day", status: "awaiting_browser_video" },
        { generator: "self-mini-quiz", status: "queued" },
      ]}
    />);

    expect(screen.getByRole("button", { name: "Başarılı: 2 içerik" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Hatalı: 1 içerik" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bekleyen: 2 içerik" })).toBeVisible();

    const failedButton = screen.getByRole("button", { name: "Hatalı: 1 içerik" });
    fireEvent.mouseEnter(failedButton);
    const failedMenu = screen.getByRole("dialog", { name: "Hatalı içerikler" });
    expect(failedMenu).toHaveTextContent("Fun FoxiesDeck postu");
    expect(failedMenu).toHaveTextContent("caption_generation_failed");
    expect(failedMenu).toHaveClass("fixed", "max-h-80", "overflow-y-auto");
    expect(failedMenu.parentElement).toBe(document.body);

    fireEvent.click(failedButton);
    expect(failedButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(failedButton);
    expect(failedButton).toHaveAttribute("aria-expanded", "true");
    expect(failedButton).toHaveAttribute("aria-controls", "automation-status-failed");
  });
});
