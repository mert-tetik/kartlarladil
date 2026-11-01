"use client";

import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-client";

export function NativeAppLaunchContentGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { user, isSessionReady } = useAuthSession();

  if (enabled && (!isSessionReady || !user)) {
    return null;
  }

  return children;
}
