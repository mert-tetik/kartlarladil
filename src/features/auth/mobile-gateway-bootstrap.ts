export function shouldKeepMobileGatewayBootstrapVisible({
  mounted,
  isPublicMobilePath,
  isRankUpTestMode,
}: {
  mounted: boolean;
  isPublicMobilePath: boolean;
  isRankUpTestMode: boolean;
}) {
  if (isPublicMobilePath || isRankUpTestMode) {
    return false;
  }

  return !mounted;
}
