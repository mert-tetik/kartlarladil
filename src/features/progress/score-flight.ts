const POINTS_PER_SCORE_FLIGHT_ICON = 2;
const MAX_SCORE_FLIGHT_ICONS = 25;

export function getScoreFlightIconCount(points: number): number {
  const normalizedPoints = Math.max(0, Math.round(points));
  return Math.min(
    Math.ceil(normalizedPoints / POINTS_PER_SCORE_FLIGHT_ICON),
    MAX_SCORE_FLIGHT_ICONS,
  );
}

/**
 * Returns the cumulative award to display when an icon reaches the score counter.
 * The final arrival always equals the full reward, even after the icon cap is reached.
 */
export function getScoreFlightAwardAtArrival(
  totalPoints: number,
  iconCount: number,
  arrivalIndex: number,
): number {
  if (totalPoints <= 0 || iconCount <= 0 || arrivalIndex <= 0) {
    return 0;
  }

  const boundedArrivalIndex = Math.min(arrivalIndex, iconCount);
  return Math.round((totalPoints * boundedArrivalIndex) / iconCount);
}
