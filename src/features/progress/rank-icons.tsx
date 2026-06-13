import Image from "next/image";
import { cn } from "@/lib/utils";
import type { RankIconId } from "@/types/domain";

const RANK_ICON_ASSETS: Record<RankIconId, string> = {
  trophy: "/ranks/rank1.png",
  medal: "/ranks/rank2.png",
  book: "/ranks/rank3.png",
  compass: "/ranks/rank4.png",
  graduation: "/ranks/rank5.png",
  star: "/ranks/rank6.png",
  languages: "/ranks/rank7.png",
  gem: "/ranks/rank8.png",
  crown: "/ranks/rank9.png",
  flame: "/ranks/rank10.png",
};

export function RankIcon({ icon, className }: { icon: RankIconId; className?: string }) {
  return (
    <Image
      src={RANK_ICON_ASSETS[icon]}
      alt=""
      width={512}
      height={512}
      sizes="48px"
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
