import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { SubscriptionPurchaseSuccessDialog } from "@/features/subscriptions/components/subscription-purchase-success-dialog";

it("renders the localized branded success dialog and continues explicitly", async () => {
  const onContinue = vi.fn();
  const user = userEvent.setup();

  render(
    <LocaleProvider initialLocale="tr">
      <SubscriptionPurchaseSuccessDialog open onContinue={onContinue} />
    </LocaleProvider>,
  );

  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Abonelik alindi!" })).toHaveClass("font-super-water");
  expect(screen.getByText("Satin alimin icin cok tesekkur ederiz!")).toBeInTheDocument();

  const continueButton = screen.getByRole("button", { name: "Ogrenmeye Basla!" });
  expect(continueButton).toHaveClass("bg-white", "text-brand", "rounded-full", "font-super-water");
  await user.click(continueButton);

  expect(onContinue).toHaveBeenCalledOnce();
});
