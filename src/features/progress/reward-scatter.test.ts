import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRewardScatterFlights,
  getGemFlightAwardAtArrival,
  getMedalFlightAwardAtArrival,
} from "./reward-scatter";

describe("createRewardScatterFlights", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses independent point and per-gem source and target geometry in one request", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const flights = createRewardScatterFlights({
      points: {
        amount: 4,
        source: { left: 100, top: 200, width: 80, height: 40 },
        target: { left: 300, top: 20, width: 40, height: 20 },
      },
      gems: [
        {
          type: "blue",
          amount: 1,
          source: { left: 500, top: 100, width: 60, height: 30 },
          target: { left: 700, top: 50, width: 20, height: 20 },
          placement: { origin: "center" },
        },
      ],
    });

    expect(flights).toHaveLength(3);
    expect(flights.filter((flight) => flight.channel === "points")).toEqual([
      expect.objectContaining({
        visual: { kind: "points" },
        startX: 140,
        startY: 220,
        targetX: 320,
        targetY: 30,
        pointsAwarded: 2,
      }),
      expect.objectContaining({
        visual: { kind: "points" },
        startX: 140,
        startY: 220,
        targetX: 320,
        targetY: 30,
        pointsAwarded: 4,
      }),
    ]);
    expect(flights.find((flight) => flight.channel === "gems")).toEqual(
      expect.objectContaining({
        visual: { kind: "gem", type: "blue" },
        startX: 530,
        startY: 115,
        targetX: 710,
        targetY: 60,
      }),
    );
  });

  it("allows a single gem image to fly as a converted-points particle", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const [flight] = createRewardScatterFlights({
      points: {
        amount: 20,
        iconCount: 1,
        gemIcon: "purple",
        source: { left: 10, top: 20, width: 30, height: 40 },
        target: { left: 90, top: 100, width: 10, height: 10 },
        placement: { origin: "center" },
        scatterOffset: { x: 0, y: -36 },
      },
    });

    expect(flight).toEqual(expect.objectContaining({
      channel: "points",
      visual: { kind: "gem", type: "purple" },
      pointsAwarded: 20,
      startX: 25,
      startY: 40,
      scatterX: 0,
      scatterY: -36,
    }));
  });

  it("distributes large gem totals across the bounded visible flights without losing value", () => {
    const flightAwards = Array.from({ length: 25 }, (_, index) => getGemFlightAwardAtArrival(115, 25, index + 1));

    expect(flightAwards.reduce((sum, amount) => sum + amount, 0)).toBe(115);
    expect(new Set(flightAwards)).toEqual(new Set([4, 5]));
    const smallAward = Array.from({ length: 25 }, (_, index) => getGemFlightAwardAtArrival(5, 25, index + 1));
    expect(smallAward.reduce((sum, amount) => sum + amount, 0)).toBe(5);
  });

  it("creates one dedicated flight and one arrival award per earned medal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const flights = createRewardScatterFlights({
      medals: {
        amount: 5,
        source: { left: 300, top: 400, width: 100, height: 40 },
        target: { left: 16, top: 16, width: 60, height: 28 },
        scatterOffset: { x: -48, y: -44 },
      },
    });

    expect(flights).toHaveLength(5);
    expect(flights.every((flight) => flight.channel === "medals")).toBe(true);
    expect(flights.every((flight) => flight.animation === "medal")).toBe(true);
    expect(flights.every((flight) => flight.scatterX === -48 && flight.scatterY === -44)).toBe(true);
    expect(flights.map((flight) => flight.pointsAwarded)).toEqual([1, 1, 1, 1, 1]);

    const awards = Array.from({ length: 5 }, (_, index) => getMedalFlightAwardAtArrival(5, 5, index + 1));
    expect(awards).toEqual([1, 1, 1, 1, 1]);
  });
});
