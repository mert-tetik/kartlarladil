import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/dictionaries";

export const PROFILE_PICTURE_COUNT = 19;
export const PROFILE_PICTURE_NAMES = [
  "cat",
  "dog",
  "rabbit",
  "bear",
  "panda",
  "lion",
  "elephant",
  "penguin",
  "koala",
  "monkey",
  "giraffe",
  "zebra",
  "cow",
  "pig",
  "frog",
  "chick",
  "sheep",
  "raccoon",
  "hippopotamus",
] as const;

export function getProfilePictureSource(profilePictureIndex: number | null | undefined) {
  const resolvedIndex =
    typeof profilePictureIndex === "number" &&
    Number.isInteger(profilePictureIndex) &&
    profilePictureIndex >= 0 &&
    profilePictureIndex < PROFILE_PICTURE_COUNT
      ? profilePictureIndex
      : 0;

  return `/profile-pictures/pp_${resolvedIndex + 1}.webp`;
}

export function getProfilePictureNameKey(profilePictureIndex: number): TranslationKey {
  const name = PROFILE_PICTURE_NAMES[profilePictureIndex] ?? PROFILE_PICTURE_NAMES[0];
  return `profilePicture.name.${name}` as TranslationKey;
}

export function ProfilePicture({
  profilePictureIndex,
  alt,
  className,
}: {
  profilePictureIndex: number | null | undefined;
  alt: string;
  className?: string;
}) {
  return (
    <span className={cn("block shrink-0 overflow-hidden", className)}>
      {/* Keep the upper portrait area prominent in the compact avatar crop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getProfilePictureSource(profilePictureIndex)}
        alt={alt}
        className="size-full origin-top -translate-y-[5%] scale-[1.7] object-cover object-top"
        draggable={false}
      />
    </span>
  );
}
