import { describe, expect, it } from "vitest";
import {
  isSelfFalseFriendsContent,
  normalizeSelfFalseFriendsTerm,
  orderSelfFalseFriendsByTier,
} from "@/features/twitter-automation/self-false-friends";

describe("self false friends", () => {
  it("normalizes generated terms before duplicate checks", () => {
    expect(normalizeSelfFalseFriendsTerm("  FURIOUS  ")).toBe("furious");
  });

  it("requires both terms and both native-language explanations", () => {
    expect(isSelfFalseFriendsContent({
      firstTerm: "angry",
      secondTerm: "furious",
      firstTier: "A2",
      secondTier: "B2",
      firstExplanation: "Angry genel bir öfke hissini anlatır.",
      secondExplanation: "Furious ise daha yoğun bir öfkeyi anlatır.",
    })).toBe(true);
    expect(isSelfFalseFriendsContent({ firstTerm: "angry", secondTerm: "furious" })).toBe(false);
    expect(isSelfFalseFriendsContent({
      firstTerm: "angry",
      secondTerm: "furious",
      firstTier: "C2",
      secondTier: "B2",
      firstExplanation: "Angry has a general sense of anger.",
      secondExplanation: "Furious describes a much stronger anger.",
    })).toBe(false);
  });

  it("puts the higher tier on the left while preserving equal-tier order", () => {
    expect(orderSelfFalseFriendsByTier({
      firstTerm: "angry",
      secondTerm: "furious",
      firstTier: "A2",
      secondTier: "B2",
      firstExplanation: "Angry is a general feeling of anger.",
      secondExplanation: "Furious is a much stronger anger.",
    })).toMatchObject({ firstTerm: "furious", firstTier: "B2", secondTerm: "angry", secondTier: "A2" });

    expect(orderSelfFalseFriendsByTier({
      firstTerm: "look",
      secondTerm: "watch",
      firstTier: "B1",
      secondTier: "B1",
      firstExplanation: "Look means directing your eyes toward something.",
      secondExplanation: "Watch means looking at something for a period.",
    })).toMatchObject({ firstTerm: "look", secondTerm: "watch", firstTier: "B1", secondTier: "B1" });
  });
});
