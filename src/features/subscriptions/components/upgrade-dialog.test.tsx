import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function renderDialog(props: { open: boolean; errorCode: Parameters<typeof UpgradeDialog>[0]["errorCode"] }) {
  const onOpenChange = vi.fn();
  const result = render(
    <LocaleProvider initialLocale="tr">
      <UpgradeDialog open={props.open} errorCode={props.errorCode} onOpenChange={onOpenChange} />
    </LocaleProvider>,
  );
  return { ...result, onOpenChange };
}

describe("UpgradeDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = renderDialog({ open: false, errorCode: "free_active_card_limit" });

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there is no error code", () => {
    const { container } = renderDialog({ open: true, errorCode: null });

    expect(container.firstChild).toBeNull();
  });

  it("shows the active card limit message and a pricing link", () => {
    renderDialog({ open: true, errorCode: "free_active_card_limit" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent(/Aktif kart kotan doldu/i);
    expect(screen.getByRole("link", { name: /İLK AY ÜCRETSİZ/i })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: /Kartları öğren/i })).toHaveAttribute("href", "/learn");
  });

  it("shows the learned card limit message", () => {
    renderDialog({ open: true, errorCode: "free_learned_card_limit" });

    expect(screen.getByRole("heading")).toHaveTextContent(/Öğrenilen kart kotan doldu/i);
  });

  it("shows the ai daily limit message", () => {
    renderDialog({ open: true, errorCode: "ai_daily_limit" });

    expect(screen.getByRole("heading")).toHaveTextContent(/Günlük AI mesaj kotan doldu/i);
  });

  it("shows the ai monthly limit message", () => {
    renderDialog({ open: true, errorCode: "ai_monthly_limit" });

    expect(screen.getByRole("heading")).toHaveTextContent(/Aylık AI mesaj kotan doldu/i);
  });

  it("shows the learn page locale lock message without a pricing link", () => {
    renderDialog({ open: true, errorCode: "learn_locale_locked" });

    expect(screen.getByRole("heading")).toHaveTextContent(/Öğren sayfasındayken site dili değiştirilemez/i);
    expect(screen.queryByRole("link", { name: /İLK AY ÜCRETSİZ/i })).not.toBeInTheDocument();
  });

  it("shows the already learning card message without a pricing link", () => {
    renderDialog({ open: true, errorCode: "inventory_card_already_active" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plan/i })).not.toBeInTheDocument();
  });

  it("shows the already learned card message without a pricing link", () => {
    renderDialog({ open: true, errorCode: "inventory_card_already_learned" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plan/i })).not.toBeInTheDocument();
  });

  it("closes the dialog when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ open: true, errorCode: "free_active_card_limit" });

    await user.click(screen.getByRole("button", { name: /Kapat/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes the dialog when maybe later is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ open: true, errorCode: "free_active_card_limit" });

    await user.click(screen.getByRole("button", { name: /Belki sonra/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
