import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { ActiveCardLimitDetails } from "@/types/domain";

const mockPush = vi.fn();
const mockRequireAuthAction = vi.fn((action: () => void) => action());
const billingMocks = vi.hoisted(() => ({
  isTwa: false,
  purchase: vi.fn(async () => ({})),
  getProductDetails: vi.fn(async () => ({
    itemId: "basic_monthly",
    price: { value: "4.99", currency: "USD" },
  })),
  showMessage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/auth/auth-client", () => ({
  AuthSessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthSession: () => ({
    user: null,
    refreshProfile: vi.fn(),
    updateProfileField: vi.fn(),
    clearUser: vi.fn(),
    requireAuthAction: mockRequireAuthAction,
  }),
  useRequireAuthAction: () => mockRequireAuthAction,
}));

vi.mock("@/features/install-app/use-twa-mode", () => ({
  useTwaMode: () => billingMocks.isTwa,
}));

vi.mock("@/features/subscriptions/use-google-play-billing", () => ({
  useGooglePlayBilling: () => ({
    purchase: billingMocks.purchase,
    getProductDetails: billingMocks.getProductDetails,
    isLoading: false,
    isSupported: true,
  }),
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => ({
    entitlements: { effectivePlan: "free" },
    isLoading: false,
  }),
}));

vi.mock("@/components/app-message-provider", () => ({
  useAppMessage: () => ({ showMessage: billingMocks.showMessage }),
}));

beforeEach(() => {
  billingMocks.isTwa = false;
  vi.clearAllMocks();
});

function renderDialog(props: {
  open: boolean;
  errorCode: Parameters<typeof UpgradeDialog>[0]["errorCode"];
  activeCardLimitDetails?: ActiveCardLimitDetails | null;
  activeCardLimitDescription?: string;
  overlayClassName?: string;
  onPricingNavigate?: () => void;
  onPurchaseSuccess?: () => void | Promise<void>;
}) {
  const onOpenChange = vi.fn();
  const result = render(
    <LocaleProvider initialLocale="tr">
      <UpgradeDialog
        open={props.open}
        errorCode={props.errorCode}
        onOpenChange={onOpenChange}
        activeCardLimitDetails={props.activeCardLimitDetails}
        activeCardLimitDescription={props.activeCardLimitDescription}
        overlayClassName={props.overlayClassName}
        onPricingNavigate={props.onPricingNavigate}
        onPurchaseSuccess={props.onPurchaseSuccess}
      />
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
    expect(screen.getByRole("heading")).toHaveTextContent(/Aktif öğrenilecek kart kotan doldu/i);
    expect(screen.getByRole("link", { name: /ILK AY ÜCRETSIZ/i })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: /Kartları öğren/i })).toHaveClass("bg-action-learn");
  });

  it("shows group addition counts when a group hits the active card limit", () => {
    renderDialog({
      open: true,
      errorCode: "free_active_card_limit",
      activeCardLimitDetails: { addedCount: 3, skippedCount: 2 },
    });

    expect(screen.getByText(/3.*2/)).toBeInTheDocument();
  });

  it("allows offline note imports to show their own added and remaining counts", () => {
    renderDialog({
      open: true,
      errorCode: "free_active_card_limit",
      activeCardLimitDetails: { addedCount: 4, skippedCount: 6 },
      activeCardLimitDescription: "4 cards were added. 6 remain saved on this device.",
      overlayClassName: "z-[2100]",
    });

    expect(screen.getByText("4 cards were added. 6 remain saved on this device.")).toBeInTheDocument();
    expect(screen.getByRole("dialog").parentElement).toHaveClass("z-[2100]");
  });

  it("notifies the tutorial before opening pricing", async () => {
    const user = userEvent.setup();
    const onPricingNavigate = vi.fn();
    const { onOpenChange } = renderDialog({
      open: true,
      errorCode: "free_active_card_limit",
      onPricingNavigate,
    });

    await user.click(screen.getByRole("link", { name: /ILK AY ÜCRETSIZ/i }));

    expect(onPricingNavigate).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("starts the Basic monthly Play purchase in TWA and resumes the blocked action", async () => {
    billingMocks.isTwa = true;
    const user = userEvent.setup();
    const onPricingNavigate = vi.fn();
    const onPurchaseSuccess = vi.fn();
    const { onOpenChange } = renderDialog({
      open: true,
      errorCode: "free_active_card_limit",
      onPricingNavigate,
      onPurchaseSuccess,
    });

    expect(screen.queryByRole("link", { name: /ILK AY/i })).not.toBeInTheDocument();
    const purchaseButton = await screen.findByRole("button", { name: /Basic.*4,99|Basic.*4\.99/i });
    await user.click(purchaseButton);

    await waitFor(() => {
      expect(billingMocks.purchase).toHaveBeenCalledWith("basic_monthly");
      expect(onPurchaseSuccess).toHaveBeenCalledOnce();
    });
    expect(onPricingNavigate).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("navigates to the learn page when the learn cards button is clicked", async () => {
    const user = userEvent.setup();
    renderDialog({ open: true, errorCode: "free_active_card_limit" });

    await user.click(screen.getByRole("button", { name: /Kartları öğren/i }));

    expect(mockRequireAuthAction).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/learn?mode=active");
    });
  });

  it("shows the learned card limit message", () => {
    renderDialog({ open: true, errorCode: "free_learned_card_limit" });

    expect(screen.getByRole("heading")).toHaveTextContent(/Öğrenilen kart kotan doldu/i);
  });

  it("shows the learned review subscription message", () => {
    renderDialog({ open: true, errorCode: "learned_review_subscription_required" });

    expect(screen.getByRole("heading")).toHaveTextContent(/abonelik gerekli/i);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: /Belki sonra/i })).toBeInTheDocument();
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

  it("uses the games language message without a swap action", () => {
    renderDialog({ open: true, errorCode: "game_language_match_not_allowed" });

    expect(screen.getByRole("heading")).toHaveTextContent("Oyun dili ve site dili aynı olamaz");
    expect(screen.getByRole("dialog")).toHaveClass("bg-brand");
    expect(screen.getByRole("button", { name: "Şimdi değil" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dillerin yerlerini değiştir" })).not.toBeInTheDocument();
  });

  it("closes the dialog when Maybe later is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ open: true, errorCode: "free_active_card_limit" });

    await user.click(screen.getByRole("button", { name: /Belki sonra/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes the dialog when maybe later is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ open: true, errorCode: "free_active_card_limit" });

    await user.click(screen.getByRole("button", { name: /Belki sonra/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
