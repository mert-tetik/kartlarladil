export function getSingleLineFitFontSize(
  baseFontSize: number,
  measuredTextWidth: number,
  availableWidth: number,
) {
  if (
    baseFontSize <= 0
    || measuredTextWidth <= 0
    || availableWidth <= 0
    || measuredTextWidth <= availableWidth
  ) {
    return baseFontSize;
  }

  return baseFontSize * (availableWidth / measuredTextWidth) * 0.98;
}
