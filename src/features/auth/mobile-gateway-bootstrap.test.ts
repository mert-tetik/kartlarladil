import { shouldKeepMobileGatewayBootstrapVisible } from "@/features/auth/mobile-gateway-bootstrap";

const baseState = {
  mounted: true,
  isPublicMobilePath: false,
  isRankUpTestMode: false,
};

describe("mobile gateway bootstrap", () => {
  it("covers the initial mobile render before client state is ready", () => {
    expect(
      shouldKeepMobileGatewayBootstrapVisible({ ...baseState, mounted: false }),
    ).toBe(true);
  });

  it("only uses the bootstrap until the client mounts", () => {
    expect(
      shouldKeepMobileGatewayBootstrapVisible({
        ...baseState,
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
