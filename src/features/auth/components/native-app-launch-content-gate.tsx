"use client";

import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { isNativeLaunchDataReady } from "@/features/auth/native-launch-readiness";
import { useInventoryStore } from "@/features/inventory/inventory-store";

export function NativeAppLaunchContentGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { user, isSessionReady } = useAuthSession();
  const inventoryHydrated = useInventoryStore((state) => state.hydrated);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);

  if (enabled && (!isSessionReady || !user)) {
    return null;
  }

  if (enabled && !isNativeLaunchDataReady({
    isSessionReady,
    userId: user?.id ?? null,
    inventoryHydrated,
    ownerUserId,
  })) {
    return null;
  }

  return children;
}
