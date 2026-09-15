const POINTS_PER_SCORE_FLIGHT_ICON = 2;
const MAX_SCORE_FLIGHT_ICONS = 25;

export const SCORE_FLIGHT_DURATION_MS = 700;
export const SCORE_FLIGHT_LAST_START_MS = 780;

export interface ScoreFlightSourceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getScoreFlightMotion(
  source: ScoreFlightSourceRect,
  index: number,
  iconCount: number,
) {
  const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
  const startX = source.left + source.width * (0.22 + Math.random() * 0.56);
  const startY = source.top + source.height * (0.24 + Math.random() * 0.52);

  return {
    startX,
    startY,
    scatterX: (Math.random() - 0.5) * 150,
    scatterY: -35 - Math.random() * 100,
    delay: Math.round(ratio * SCORE_FLIGHT_LAST_START_MS),
  };
}

/** The reward scatter used by the chest opening animation. */
export function getChestRewardFlightMotion(
  source: ScoreFlightSourceRect,
  index: number,
  iconCount: number,
) {
  const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
  const startX = source.left + source.width / 2 + (Math.random() - 0.5) * source.width * 0.55;
  const startY = source.top + source.height / 2 + (Math.random() - 0.5) * source.height * 0.35;

  return {
    startX,
    startY,
    scatterX: (Math.random() - 0.5) * 150,
    scatterY: -35 - Math.random() * 100,
    delay: Math.round(ratio * SCORE_FLIGHT_LAST_START_MS),
  };
}

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
