import type { GemType } from "@/features/gems/gem-types";
import type { SoundEffectName } from "@/lib/sound-effects";

const POINTS_PER_SCORE_FLIGHT_ICON = 2;
const MAX_SCORE_FLIGHT_ICONS = 25;
const MAX_GEM_FLIGHT_ICONS = 25;
const MAX_MEDAL_FLIGHT_ICONS = 5;

export const SCORE_FLIGHT_DURATION_MS = 700;
export const SCORE_FLIGHT_LAST_START_MS = 780;

export interface RewardScatterRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type RewardScatterAnchor =
  | RewardScatterRect
  | HTMLElement
  | { current: HTMLElement | null }
  | null;

export interface RewardScatterPlacement {
  origin?: "center" | "random";
  spreadX?: number;
  spreadY?: number;
  spreadUnit?: "fraction" | "pixels";
}

export interface RewardScatterMotion {
  scatterOffset?: { x: number; y: number };
  arrivalSoundEffect?: SoundEffectName;
  iconSize?: number;
  zIndex?: number;
  startDelayMs?: number;
  placement?: RewardScatterPlacement;
}

export interface RewardScatterPointsRequest extends RewardScatterMotion {
  amount: number;
  source: RewardScatterRect;
  target: RewardScatterRect;
  /** Defaults to one score icon per two points. */
  iconCount?: number;
  /** Use a gem image when a gem is being converted into points. */
  gemIcon?: GemType;
}

export interface RewardScatterGemRequest extends RewardScatterMotion {
  type: GemType;
  amount: number;
  source: RewardScatterRect;
  target: RewardScatterRect;
}

export interface RewardScatterMedalsRequest extends RewardScatterMotion {
  amount: number;
  source: RewardScatterRect;
  sources?: readonly RewardScatterRect[];
  target: RewardScatterRect;
}

export interface RewardScatterFlight {
  id: string;
  channel: "points" | "gems" | "medals";
  animation: "default" | "medal";
  visual: { kind: "points" } | { kind: "gem"; type: GemType } | { kind: "medal" };
  gemType?: GemType;
  gemAmountAwarded?: number;
  arrivalIndex: number;
  pointsAwarded?: number;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
  iconSize: number;
  zIndex: number;
  arrivalSoundEffect: SoundEffectName;
}

export interface CreateRewardScatterFlightsInput {
  points?: RewardScatterPointsRequest | null;
  gems?: readonly RewardScatterGemRequest[] | null;
  medals?: RewardScatterMedalsRequest | null;
}

export function getScoreFlightIconCount(points: number): number {
  const normalizedPoints = Math.max(0, Math.round(points));
  return Math.min(
    Math.ceil(normalizedPoints / POINTS_PER_SCORE_FLIGHT_ICON),
    MAX_SCORE_FLIGHT_ICONS,
  );
}

/** The cumulative award to display as each score particle reaches its target. */
export function getScoreFlightAwardAtArrival(
  totalPoints: number,
  iconCount: number,
  arrivalIndex: number,
): number {
  if (totalPoints <= 0 || iconCount <= 0 || arrivalIndex <= 0) return 0;
  const boundedArrivalIndex = Math.min(arrivalIndex, iconCount);
  return Math.round((totalPoints * boundedArrivalIndex) / iconCount);
}

/** Distributes large gem totals across the bounded number of visible flight icons. */
export function getGemFlightAwardAtArrival(
  totalAmount: number,
  iconCount: number,
  arrivalIndex: number,
): number {
  if (totalAmount <= 0 || iconCount <= 0 || arrivalIndex <= 0) return 0;
  const boundedArrivalIndex = Math.min(arrivalIndex, iconCount);
  const previousTotal = Math.round((totalAmount * (boundedArrivalIndex - 1)) / iconCount);
  const currentTotal = Math.round((totalAmount * boundedArrivalIndex) / iconCount);
  return currentTotal - previousTotal;
}

export function getMedalFlightAwardAtArrival(
  totalMedals: number,
  iconCount: number,
  arrivalIndex: number,
): number {
  if (totalMedals <= 0 || iconCount <= 0 || arrivalIndex <= 0) return 0;
  const boundedArrivalIndex = Math.min(arrivalIndex, iconCount);
  const previousTotal = Math.round((totalMedals * (boundedArrivalIndex - 1)) / iconCount);
  const currentTotal = Math.round((totalMedals * boundedArrivalIndex) / iconCount);
  return currentTotal - previousTotal;
}

function getMotion(
  source: RewardScatterRect,
  target: RewardScatterRect,
  index: number,
  count: number,
  options: RewardScatterMotion,
) {
  const ratio = count === 1 ? 0 : index / (count - 1);
  const placement = options.placement;
  const spreadX = placement?.spreadX ?? 0.56;
  const spreadY = placement?.spreadY ?? 0.52;
  const spreadUnit = placement?.spreadUnit ?? "fraction";
  const randomize = placement?.origin !== "center";
  const spreadScaleX = spreadUnit === "pixels" ? 1 : source.width;
  const spreadScaleY = spreadUnit === "pixels" ? 1 : source.height;
  const startX = source.left + source.width / 2 + (randomize ? (Math.random() - 0.5) * spreadX * spreadScaleX : 0);
  const startY = source.top + source.height / 2 + (randomize ? (Math.random() - 0.5) * spreadY * spreadScaleY : 0);
  const fixedScatter = options.scatterOffset;

  return {
    startX,
    startY,
    scatterX: fixedScatter?.x ?? (Math.random() - 0.5) * 150,
    scatterY: fixedScatter?.y ?? -35 - Math.random() * 100,
    targetX: target.left + target.width / 2,
    targetY: target.top + target.height / 2,
    delay: Math.round(ratio * SCORE_FLIGHT_LAST_START_MS) + (options.startDelayMs ?? 0),
    iconSize: options.iconSize ?? 32,
    zIndex: options.zIndex ?? 50,
    arrivalSoundEffect: options.arrivalSoundEffect ?? "points",
  };
}

/** Creates score and per-gem flights from independently supplied source and target geometry. */
export function createRewardScatterFlights({ points, gems, medals }: CreateRewardScatterFlightsInput): RewardScatterFlight[] {
  const flights: RewardScatterFlight[] = [];

  if (points && points.amount > 0) {
    const iconCount = Math.max(1, Math.min(points.iconCount ?? getScoreFlightIconCount(points.amount), MAX_SCORE_FLIGHT_ICONS));
    for (let index = 0; index < iconCount; index += 1) {
      flights.push({
        id: `points-${index}`,
        channel: "points",
        animation: "default",
        visual: points.gemIcon ? { kind: "gem", type: points.gemIcon } : { kind: "points" },
        arrivalIndex: index + 1,
        pointsAwarded: getScoreFlightAwardAtArrival(points.amount, iconCount, index + 1),
        ...getMotion(points.source, points.target, index, iconCount, points),
      });
    }
  }

  let nextGemId = 0;
  for (const gem of gems ?? []) {
    const iconCount = Math.min(Math.max(0, Math.round(gem.amount)), MAX_GEM_FLIGHT_ICONS);
    for (let index = 0; index < iconCount; index += 1) {
      flights.push({
        id: `gem-${gem.type}-${nextGemId++}`,
        channel: "gems",
        animation: "default",
        visual: { kind: "gem", type: gem.type },
        gemType: gem.type,
        arrivalIndex: index + 1,
        gemAmountAwarded: getGemFlightAwardAtArrival(gem.amount, iconCount, index + 1),
        ...getMotion(gem.source, gem.target, index, iconCount, {
          ...gem,
          iconSize: gem.iconSize ?? 40,
          arrivalSoundEffect: gem.arrivalSoundEffect ?? "gem-loot",
        }),
      });
    }
  }

  if (medals && medals.amount > 0) {
    const iconCount = Math.min(Math.max(0, Math.round(medals.amount)), MAX_MEDAL_FLIGHT_ICONS);
    const medalIconSize = medals.iconSize ?? 40;
    for (let index = 0; index < iconCount; index += 1) {
      const source = medals.sources?.[index] ?? medals.source;
      const motion = getMotion(source, medals.target, index, iconCount, {
        ...medals,
        iconSize: medalIconSize,
      });
      flights.push({
        id: `medal-${index}`,
        channel: "medals",
        animation: "medal",
        visual: { kind: "medal" },
        arrivalIndex: index + 1,
        pointsAwarded: getMedalFlightAwardAtArrival(medals.amount, iconCount, index + 1),
        ...motion,
        startX: motion.startX - medalIconSize / 2,
        startY: motion.startY - medalIconSize / 2,
        targetX: motion.targetX - medalIconSize / 2,
        targetY: motion.targetY - medalIconSize / 2,
      });
    }
  }

  return flights;
}
