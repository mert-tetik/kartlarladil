import { GEM_ASSETS } from "@/features/gems/gem-types";

export const BONUS_REWARD_IMAGE = "/quiz/bonus_img.webp?v=20261001-1";

let bonusRewardImagePreload: HTMLImageElement | null = null;
const bonusRewardBurstImagePreloads: HTMLImageElement[] = [];
let bonusRewardImageLeaseCount = 0;

export function preloadBonusRewardImage() {
  if (typeof window === "undefined") return () => undefined;

  bonusRewardImageLeaseCount += 1;

  if (!bonusRewardImagePreload) {
    bonusRewardImagePreload = new window.Image();
    bonusRewardImagePreload.decoding = "async";
    bonusRewardImagePreload.loading = "eager";
    bonusRewardImagePreload.src = BONUS_REWARD_IMAGE;
    if (typeof bonusRewardImagePreload.decode === "function") {
      void bonusRewardImagePreload.decode().catch(() => undefined);
    }
  }

  if (bonusRewardBurstImagePreloads.length === 0) {
    ["/score-icon.webp", ...Object.values(GEM_ASSETS)].forEach((source) => {
      const image = new window.Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = source;
      if (typeof image.decode === "function") {
        void image.decode().catch(() => undefined);
      }
      bonusRewardBurstImagePreloads.push(image);
    });
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bonusRewardImageLeaseCount = Math.max(0, bonusRewardImageLeaseCount - 1);

    if (bonusRewardImageLeaseCount === 0) {
      bonusRewardImagePreload = null;
      bonusRewardBurstImagePreloads.length = 0;
    }
  };
}
