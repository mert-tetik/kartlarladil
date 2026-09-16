import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppImageCacheGate } from "@/components/app-image-cache-gate";

describe("AppImageCacheGate", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("stays visible when the loading test URL parameter is enabled", async () => {
    window.history.replaceState({}, "", "/?loading-test=1");

    render(<AppImageCacheGate />);

    const gate = await waitFor(() => screen.getByTestId("app-image-cache-gate"));
    expect(gate).toHaveAttribute("aria-busy", "true");
    expect(gate).toHaveAttribute("aria-label", "Loading");

    await new Promise((resolve) => window.setTimeout(resolve, 350));
    expect(screen.getByTestId("app-image-cache-gate")).toBeInTheDocument();
  });
});
