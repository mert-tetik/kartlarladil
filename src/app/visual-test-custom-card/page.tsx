"use client";

import { useState } from "react";
import { MobileCustomCardSheet } from "@/app/components/mobile-custom-card-sheet";

export default function VisualTestCustomCardPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] p-4">
      <button type="button" onClick={() => setOpen(true)}>Open custom card sheet</button>
      <MobileCustomCardSheet open={open} onClose={() => setOpen(false)} landingLanguage="en" />
    </div>
  );
}
