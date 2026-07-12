import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTierSelector } from "@/app/components/mobile-tier-selector";
import { requestMobileNavbarBack } from "@/components/mobile-navbar-back";
import { LocaleProvider } from "@/i18n/locale-provider";

const { advanceTutorialMock, routerPushMock } = vi.hoisted(() => ({
  advanceTutorialMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/tutorial/tutorial-store", () => ({
  useTutorialStore: {
    getState: () => ({
      completed: true,
      step: 0,
      advance: advanceTutorialMock,
    }),
  },
}));

describe("MobileTierSelector", () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    advanceTutorialMock.mockReset();
  });

  it("routes the all option to the all-tier card draw filter", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <LocaleProvider initialLocale="tr">
        <MobileTierSelector isOpen onClose={onClose} language="en" />
      </LocaleProvider>,
    );

    const allButton = screen.getByRole("button", { name: "Tümü" });
    expect(allButton).toHaveClass("bg-white", "text-black");

    await user.click(allButton);

    expect(onClose).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith("/card-draw?language=en&tier=all");
  });

  it("keeps the closed panel mounted for a smooth open transition", () => {
    const { container, rerender } = render(
      <LocaleProvider initialLocale="tr">
        <MobileTierSelector isOpen={false} onClose={vi.fn()} language="en" />
      </LocaleProvider>,
    );

    const panel = document.querySelector("[data-mobile-tier-selector]");
    expect(panel).toHaveClass("translate-y-3", "opacity-0");

    rerender(
      <LocaleProvider initialLocale="tr">
        <MobileTierSelector isOpen onClose={vi.fn()} language="en" />
      </LocaleProvider>,
    );

    expect(panel).toHaveClass("translate-y-0", "opacity-100");
    expect(container).toBeEmptyDOMElement();
  });

  it("stays below the bottom nav and closes from the navbar back action", () => {
    const onClose = vi.fn();

    render(
      <LocaleProvider initialLocale="tr">
        <MobileTierSelector isOpen onClose={onClose} language="en" />
      </LocaleProvider>,
    );

    expect(document.querySelector("[data-mobile-tier-selector]")).toHaveClass("z-30");

    requestMobileNavbarBack();

    expect(onClose).toHaveBeenCalledOnce();
  });
});
