import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLockedActionSheet } from "@/app/components/mobile-locked-action-sheet";

vi.mock("@/lib/use-is-client", () => ({
  useIsClient: () => true,
}));

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

function renderSheet(overrides: Partial<React.ComponentProps<typeof MobileLockedActionSheet>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    variant: "active" as const,
    onOpenDraw: vi.fn(),
    onOpenCreate: vi.fn(),
    onStartLearning: vi.fn(),
    canStartLearning: true,
    ...overrides,
  };

  render(<MobileLockedActionSheet {...props} />);
  return props;
}

describe("MobileLockedActionSheet", () => {
  it("opens draw and create card actions from the empty learning deck sheet", () => {
    const props = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "cards.randomDrawTitle" }));
    fireEvent.click(screen.getByRole("button", { name: "home.mobile.addCard" }));

    expect(props.onOpenDraw).toHaveBeenCalledTimes(1);
    expect(props.onOpenCreate).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("uses the landing learning action color for the empty learning deck close button", () => {
    renderSheet();

    expect(screen.getByText("common.close")).toHaveClass("bg-emerald-500");
  });

  it("keeps start learning disabled when the learned deck sheet has no learning cards", () => {
    const props = renderSheet({
      variant: "learned",
      canStartLearning: false,
    });

    const startLearning = screen.getByRole("button", { name: "home.mobile.startLearning" });
    expect(startLearning).toBeDisabled();
    fireEvent.click(startLearning);

    expect(props.onStartLearning).not.toHaveBeenCalled();
    expect(screen.getByText("common.close")).toHaveClass("bg-sky-500");
  });
});
