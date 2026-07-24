const PENDING_WEB_CHECKOUT_KEY = "foxiesdeck:pending-web-subscription-checkout";
const PENDING_WEB_CHECKOUT_TTL_MS = 30 * 60 * 1000;

interface PendingWebCheckout {
  createdAt: number;
}

export function markPendingWebSubscriptionCheckout() {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    PENDING_WEB_CHECKOUT_KEY,
    JSON.stringify({ createdAt: Date.now() } satisfies PendingWebCheckout),
  );
}

export function hasPendingWebSubscriptionCheckout() {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.sessionStorage.getItem(PENDING_WEB_CHECKOUT_KEY);
    if (!raw) return false;

    const pending = JSON.parse(raw) as PendingWebCheckout;
    const isValid = Number.isFinite(pending.createdAt) && Date.now() - pending.createdAt < PENDING_WEB_CHECKOUT_TTL_MS;
    if (!isValid) {
      clearPendingWebSubscriptionCheckout();
    }
    return isValid;
  } catch {
    clearPendingWebSubscriptionCheckout();
    return false;
  }
}

export function clearPendingWebSubscriptionCheckout() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_WEB_CHECKOUT_KEY);
}

export function removeCheckoutSuccessParam() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function hasCheckoutSuccessParam() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("checkout") === "success";
}
