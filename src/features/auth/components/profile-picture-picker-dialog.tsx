"use client";

import { useState, useTransition } from "react";
import { updateProfilePictureAction } from "@/features/auth/actions";
import { useAuthSession } from "@/features/auth/auth-client";
import { ProfilePictureOptionGrid } from "@/features/auth/components/profile-picture-option-grid";
import { ProfilePicture } from "@/features/auth/components/profile-picture";
import { useT } from "@/i18n/locale-provider";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";

interface ProfilePicturePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfilePicturePickerDialog({ open, onOpenChange }: ProfilePicturePickerDialogProps) {
  const t = useT();
  const { user, updateProfileField } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedIndex = user?.profile.profilePictureIndex ?? 0;

  function handleClose() {
    setError(null);
    onOpenChange(false);
  }

  function handleSelect(profilePictureIndex: number) {
    if (isPending || profilePictureIndex === selectedIndex) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateProfilePictureAction(profilePictureIndex);

      if (result.status === "success") {
        updateProfileField({ profilePictureIndex });
        handleClose();
        return;
      }

      setError(result.message);
    });
  }

  if (!user) return null;

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={handleClose}
      title={t("profilePicture.title")}
      titleId="profile-picture-picker-title"
      panelLabel={t("profilePicture.title")}
      panelClassName="max-h-[80dvh]"
      visual={<ProfilePicture profilePictureIndex={selectedIndex} alt="" className="size-[3.25rem] rounded-full object-cover" />}
      contentClassName="overflow-y-auto px-5 pb-6"
    >
      <ProfilePictureOptionGrid selectedIndex={selectedIndex} onSelect={handleSelect} disabled={isPending} />
      {error ? <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{error}</p> : null}
    </MobileBottomSheetShell>
  );
}
