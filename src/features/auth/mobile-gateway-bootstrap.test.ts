import { shouldKeepMobileGatewayBootstrapVisible } from "@/features/auth/mobile-gateway-bootstrap";

const baseState = {
  mounted: true,
  isMobileViewport: true,
  isPublicMobilePath: false,
  isRankUpTestMode: false,
  isOfferTriggered: false,
  isEntitlementsLoading: false,
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
