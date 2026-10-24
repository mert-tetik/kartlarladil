import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { GlobalSubscriptionDetailsOverlay } from "@/features/subscriptions/components/global-subscription-details-overlay";
import type { AuthShellUser } from "@/features/auth/auth-types";

const messageMocks = vi.hoisted(() => ({ showMessage: vi.fn() }));

vi.mock("@/components/app-message-provider", () => ({
  useAppMessage: () => ({ showMessage: messageMocks.showMessage }),
}));

vi.mock("@/features/subscriptions/components/use-localized-pricing", () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
  getLocalizedPrice: () => null,
  useLocalizedPricing: () => ({ kind: "unavailable" }),
}));

vi.mock("@/features/subscriptions/use-google-play-pricing", () => ({
  getGooglePlayPricingDetails: () => null,
  getGooglePlaySku: () => "basic_monthly",
}));

it("purchases from the global details overlay, closes it, and hands success to the restriction", async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  const purchase = vi.fn(async () => ({ status: "success" }));
  const onClose = vi.fn();
  const onPurchaseSuccess = vi.fn();
  const onPresentPurchaseSuccess = vi.fn();

  render(
    <LocaleProvider initialLocale="tr">
      <GlobalSubscriptionDetailsOverlay
        selection={{ plan: "basic", cycle: "monthly" }}
        user={{ id: "user-1" } as AuthShellUser}
        currentPlan="free"
        isTwa
        currencyCode={null}
        googlePlayPricing={{ kind: "unavailable" }}
        purchase={purchase}
        purchaseLoading={false}
        purchaseSupported
        onClose={onClose}
        onPurchaseSuccess={onPurchaseSuccess}
        onPresentPurchaseSuccess={onPresentPurchaseSuccess}
      />
    </LocaleProvider>,
  );

  const details = screen.getByRole("dialog");
  expect(details).toHaveClass("z-[10001]");
  expect(details).toHaveAttribute("data-tutorial-subscription-overlay");
  fireEvent.click(screen.getByRole("button", { name: /ABONE OL/i }));

  await waitFor(() => expect(purchase).toHaveBeenCalledWith("basic_monthly"));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

  expect(onPurchaseSuccess).toHaveBeenCalledOnce();
  expect(onPresentPurchaseSuccess).not.toHaveBeenCalled();
});
