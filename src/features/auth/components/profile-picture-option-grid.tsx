"use client";

import { Check } from "lucide-react";
import {
  PROFILE_PICTURE_COUNT,
  getProfilePictureNameKey,
  ProfilePicture,
} from "@/features/auth/components/profile-picture";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function ProfilePictureOptionGrid({
  selectedIndex,
  onSelect,
  disabled = false,
  className,
}: {
  selectedIndex: number;
  onSelect: (profilePictureIndex: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();

  return (
    <div className={cn("grid grid-cols-3 gap-x-3 gap-y-4", className)}>
      {Array.from({ length: PROFILE_PICTURE_COUNT }, (_, profilePictureIndex) => {
        const selected = selectedIndex === profilePictureIndex;
        const name = t(getProfilePictureNameKey(profilePictureIndex));

        return (
          <button
            key={profilePictureIndex}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(profilePictureIndex)}
            aria-label={name}
            aria-pressed={selected}
            className={cn(
              "group flex min-w-0 flex-col items-center gap-2 rounded-lg py-1 text-center transition-transform duration-200 active:scale-95 disabled:opacity-60",
              selected ? "text-brand" : "text-foreground-secondary hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "relative block size-20 overflow-hidden rounded-full ring-offset-2 ring-offset-background-card transition-transform duration-200 group-hover:scale-[1.03]",
                selected && "ring-2 ring-brand",
              )}
            >
              <ProfilePicture profilePictureIndex={profilePictureIndex} alt="" className="size-full rounded-full" />
              {selected ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white" aria-hidden="true">
                  <Check className="size-6" strokeWidth={3} />
                </span>
              ) : null}
            </span>
            <span className="w-full truncate text-xs font-semibold">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
