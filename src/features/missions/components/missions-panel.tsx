"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { MissionsList } from "./missions-list";

interface MissionsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MissionsPanel({ open, onClose }: MissionsPanelProps) {
  const t = useT();
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } else {
      const timer = window.setTimeout(() => setVisible(false), 300);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          onClose();
        }}
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
        aria-label={t("common.close")}
      />

      <div
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-bold text-foreground">{t("missions.title")}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrate("tap");
              onClose();
            }}
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
          <MissionsList />
        </div>
      </div>
    </div>
  );
}
