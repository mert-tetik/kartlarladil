import Image from "next/image";
import { cn } from "@/lib/utils";
import type { RankIconId } from "@/types/domain";

const RANK_ICON_SPECS: Record<RankIconId, { src: string; width: number; height: number }> = {
  trophy: { src: "/ranks/rank1.png", width: 1254, height: 1254 },
  medal: { src: "/ranks/rank2.png", width: 1254, height: 1254 },
  book: { src: "/ranks/rank3.png", width: 1254, height: 1254 },
  compass: { src: "/ranks/rank4.png", width: 1254, height: 1254 },
  graduation: { src: "/ranks/rank5.png", width: 1254, height: 1254 },
  star: { src: "/ranks/rank6.png", width: 1254, height: 1254 },
  languages: { src: "/ranks/rank7.png", width: 1254, height: 1254 },
  gem: { src: "/ranks/rank8.png", width: 1254, height: 1254 },
  crown: { src: "/ranks/rank9.png", width: 1254, height: 1254 },
  flame: { src: "/ranks/rank10.png", width: 1254, height: 1254 },
};

export const RANK_ICON_ASSETS: Record<RankIconId, string> = Object.fromEntries(
  Object.entries(RANK_ICON_SPECS).map(([key, value]) => [key, value.src]),
) as Record<RankIconId, string>;

export function RankIcon({
  icon,
  className,
  sizes = "48px",
}: {
  icon: RankIconId;
  className?: string;
  sizes?: string;
}) {
  const spec = RANK_ICON_SPECS[icon];

  return (
    <Image
      src={spec.src}
      alt=""
      width={spec.width}
      height={spec.height}
      sizes={sizes}
      unoptimized
      className={cn("shrink-0 object-contain", className)}
      aria-hidden="true"
      draggable={false}
    />
  );
}

export function getRankIconTone(icon: RankIconId) {
  void icon;
  return "";
}
