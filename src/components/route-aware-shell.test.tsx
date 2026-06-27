import { render } from "@testing-library/react";
import { vi } from "vitest";
import { usePathname } from "next/navigation";
import { RouteAwareShell } from "@/components/route-aware-shell";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

function renderWithPath(pathname: string) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  return render(<RouteAwareShell>content</RouteAwareShell>);
}

describe("RouteAwareShell", () => {
  it("hides the mobile bottom nav on full-screen study routes", () => {
    renderWithPath("/learn");

    expect(document.getElementById("main-content")).toHaveAttribute("data-mobile-hide-bottom-nav", "true");
  });

  it("keeps the bottom nav padding on regular routes", () => {
    renderWithPath("/card-draw");

    expect(document.getElementById("main-content")).not.toHaveAttribute("data-mobile-hide-bottom-nav");
  });

  it("keeps the bottom nav visible on ai-practice subroutes", () => {
    renderWithPath("/ai-practice/en/barista");

    expect(document.getElementById("main-content")).not.toHaveAttribute("data-mobile-hide-bottom-nav");
  });
});
