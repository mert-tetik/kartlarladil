import Image from "next/image";
import { cn } from "@/lib/utils";

export type MobileCardStatus = "active" | "learned";

const STATUS_ARTWORK: Record<MobileCardStatus, { src: string; alt: string }> = {
  active: { src: "/card-status/kart_ogreniliyor_madalyasi.png", alt: "" },
  learned: { src: "/card-status/kart_ogrenildi_madalyasi.png", alt: "" },
};

export function MobileCardStatusArtwork({
  status,
  active = false,
  className,
}: {
  status: MobileCardStatus;
  active?: boolean;
  className?: string;
}) {
  const artwork = STATUS_ARTWORK[status];

  return (
    <Image
      src={artwork.src}
      alt={artwork.alt}
      width={64}
      height={64}
      sizes="64px"
      className={cn("object-contain", className)}
      aria-hidden="true"
    />
  );
}
