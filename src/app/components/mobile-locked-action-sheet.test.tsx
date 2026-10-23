import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileLockedActionSheet } from "@/app/components/mobile-locked-action-sheet";

vi.mock("@/lib/use-is-client", () => ({
  useIsClient: () => true,
}));

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
  useLocale: () => ({ locale: "en" }),
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
  it.each([
    {
      variant: "active" as const,
      title: "home.mobile.noActiveCardsTitle",
      accentClass: "bg-action-learn",
    },
    {
      variant: "learned" as const,
      title: "home.mobile.noLearnedCardsTitle",
      accentClass: "bg-action-learned",
    },
  ])("renders the $variant empty-deck menu as a centered dark dialog", async ({ variant, title, accentClass }) => {
    renderSheet({ variant });

    const dialog = await screen.findByRole("dialog", { name: title });
    const panel = dialog.querySelector("[data-mobile-bottom-sheet-panel]");

    expect(dialog).toHaveAttribute("data-mobile-presentation", "centered-dialog");
    expect(dialog).toHaveClass("items-center", "justify-center");
    expect(panel).toHaveClass("rounded-2xl", "bg-[#191919]");
    expect(dialog.querySelector("[data-mobile-dialog-accent]")).toHaveClass(accentClass);
    expect(dialog.querySelector("[data-mobile-bottom-sheet-drag-handle]")).toBeNull();
  });

  it("opens draw and create card actions from the empty learning deck sheet", async () => {
    const props = renderSheet();

    fireEvent.click(await screen.findByRole("button", { name: "cards.randomDrawTitle" }));
    fireEvent.click(await screen.findByRole("button", { name: "home.mobile.addCard" }));

    expect(props.onOpenDraw).toHaveBeenCalledTimes(1);
    expect(props.onOpenCreate).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("uses the top-right close icon for the empty learning deck", async () => {
    const props = renderSheet();

    const closeButtons = await screen.findAllByRole("button", { name: "common.close" });
    const closeButton = closeButtons.at(-1);
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton!);

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "cards.randomDrawTitle" }).closest(".mobile-primary-action-depth")).not.toBeNull();
    expect(screen.getByRole("button", { name: "home.mobile.addCard" }).closest(".mobile-primary-action-depth")).not.toBeNull();
  });

  it("keeps start learning disabled when the learned deck sheet has no learning cards", async () => {
    const props = renderSheet({
      variant: "learned",
      canStartLearning: false,
    });

    const startLearning = await screen.findByRole("button", { name: "home.mobile.startLearning" });
    expect(startLearning).toBeDisabled();
    fireEvent.click(startLearning);

    expect(props.onStartLearning).not.toHaveBeenCalled();
    expect((await screen.findAllByRole("button", { name: "common.close" })).at(-1)).toBeInTheDocument();
    expect(startLearning.closest(".mobile-primary-action-depth")).toHaveClass("mobile-primary-action-depth--locked");
  });
});
