import { cn } from "@/lib/utils";

export const PROFILE_PICTURE_COUNT = 19;

export function getProfilePictureSource(profilePictureIndex: number | null | undefined) {
  const resolvedIndex =
    typeof profilePictureIndex === "number" &&
    Number.isInteger(profilePictureIndex) &&
    profilePictureIndex >= 0 &&
    profilePictureIndex < PROFILE_PICTURE_COUNT
      ? profilePictureIndex
      : 0;

  return `/profile-pictures/pp_${resolvedIndex + 1}.png`;
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getProfilePictureSource(profilePictureIndex)}
      alt={alt}
      className={cn("shrink-0 object-cover", className)}
      draggable={false}
    />
  );
}
