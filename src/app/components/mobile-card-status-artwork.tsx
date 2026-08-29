import Image from "next/image";
import { cn } from "@/lib/utils";

export type MobileCardStatus = "active" | "learned";

const STATUS_ARTWORK: Record<MobileCardStatus, { src: string; alt: string }> = {
  active: { src: "/card-status/ogrenilecek_img.png", alt: "" },
  learned: { src: "/card-status/ogrenildi_img.png", alt: "" },
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
      className={cn(
        "object-contain transition-[filter] duration-300 ease-out",
        active && "brightness-0 invert",
        className,
      )}
      aria-hidden="true"
    />
  );
}
