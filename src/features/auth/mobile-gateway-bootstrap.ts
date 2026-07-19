export function shouldKeepMobileGatewayBootstrapVisible({
  mounted,
  isMobileViewport,
  isPublicMobilePath,
  isRankUpTestMode,
  isOfferTriggered,
  isEntitlementsLoading,
}: {
  mounted: boolean;
  isMobileViewport: boolean;
  isPublicMobilePath: boolean;
  isRankUpTestMode: boolean;
  isOfferTriggered: boolean;
  isEntitlementsLoading: boolean;
}) {
  if (isPublicMobilePath || isRankUpTestMode) {
    return false;
  }

  if (!mounted) {
    return true;
  }

  return (
    isMobileViewport &&
    isOfferTriggered &&
    isEntitlementsLoading
  );
}
