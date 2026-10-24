import { shouldKeepMobileGatewayBootstrapVisible } from "@/features/auth/mobile-gateway-bootstrap";

const baseState = {
  mounted: true,
  isMobileViewport: true,
  isPublicMobilePath: false,
  isRankUpTestMode: false,
  isOfferTriggered: false,
  isEntitlementsLoading: false,
  isLoginLanguageRefresh: false,
};

describe("mobile gateway bootstrap", () => {
  it("covers the initial mobile render before client state is ready", () => {
    expect(
      shouldKeepMobileGatewayBootstrapVisible({ ...baseState, mounted: false }),
    ).toBe(true);
  });

  it("waits for a requested subscription offer to resolve", () => {
    expect(
      shouldKeepMobileGatewayBootstrapVisible({
        ...baseState,
        isOfferTriggered: true,
        isEntitlementsLoading: true,
      }),
    ).toBe(true);
  });

  it("shows the login language picker without waiting for subscription details", () => {
    expect(
      shouldKeepMobileGatewayBootstrapVisible({
        ...baseState,
        isOfferTriggered: true,
        isEntitlementsLoading: true,
        isLoginLanguageRefresh: true,
      }),
    ).toBe(false);
  });

  it("does not block public routes or a resolved app route", () => {
    expect(shouldKeepMobileGatewayBootstrapVisible(baseState)).toBe(false);
    expect(
      shouldKeepMobileGatewayBootstrapVisible({
        ...baseState,
        mounted: false,
        isPublicMobilePath: true,
      }),
    ).toBe(false);
  });
});
