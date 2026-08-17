"use client";

import { Check, Clock3, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type AutomationGenerationStatusSummaryOutput = {
  error_code?: string | null;
  generator: string;
  status: string;
};

type GeneratorCount = {
  count: number;
  errorCodes: string[];
  generator: string;
};

type StatusDefinition = {
  id: "successful" | "failed" | "waiting";
  label: string;
  icon: LucideIcon;
  matches: (status: string) => boolean;
  buttonClassName: string;
  iconClassName: string;
  menuClassName: string;
};

type MenuPosition = {
  left: number;
  top: number;
};

const MENU_WIDTH = 288;
const MENU_MAX_HEIGHT = 320;
const VIEWPORT_GUTTER = 8;
const MENU_GAP = 8;
const CLOSE_DELAY_MS = 180;

const STATUS_DEFINITIONS: StatusDefinition[] = [
  {
    id: "successful",
    label: "Başarılı",
    icon: Check,
    matches: (status) => status === "ready_to_schedule" || status === "scheduled",
    buttonClassName: "border-[#3f8a62]/60 bg-[#173524] text-[#b6f0cf] hover:bg-[#1e472e] focus-visible:outline-[#a9ecc8]",
    iconClassName: "text-[#a9ecc8]",
    menuClassName: "border-[#3f8a62]/45 bg-[#13281c] text-[#d6f7e2]",
  },
  {
    id: "failed",
    label: "Hatalı",
    icon: X,
    matches: (status) => status === "failed",
    buttonClassName: "border-[#a94b56]/60 bg-[#3a2023] text-[#ffd0d5] hover:bg-[#4b292d] focus-visible:outline-[#ffb9c1]",
    iconClassName: "text-[#ffb9c1]",
    menuClassName: "border-[#a94b56]/45 bg-[#2c1917] text-[#ffd9de]",
  },
  {
    id: "waiting",
    label: "Bekleyen",
    icon: Clock3,
    matches: (status) => status !== "ready_to_schedule" && status !== "scheduled" && status !== "failed",
    buttonClassName: "border-[#b68e2c]/60 bg-[#322916] text-[#ffe7a0] hover:bg-[#40351e] focus-visible:outline-[#f1c75b]",
    iconClassName: "text-[#f1c75b]",
    menuClassName: "border-[#b68e2c]/45 bg-[#292214] text-[#ffeaac]",
  },
];

function generatorCounts(outputs: readonly AutomationGenerationStatusSummaryOutput[], definition: StatusDefinition) {
  const counts = new Map<string, { count: number; errorCodes: Set<string> }>();
  for (const output of outputs) {
    if (!definition.matches(output.status)) continue;
    const current = counts.get(output.generator) ?? { count: 0, errorCodes: new Set<string>() };
    current.count += 1;
    if (definition.id === "failed" && output.error_code) current.errorCodes.add(output.error_code);
    counts.set(output.generator, current);
  }
  return [...counts.entries()].map(([generator, { count, errorCodes }]): GeneratorCount => ({
    generator,
    count,
    errorCodes: [...errorCodes],
  }));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function AutomationGenerationStatusSummary({ labelForGenerator, outputs }: {
  labelForGenerator: (generator: string) => string;
  outputs: readonly AutomationGenerationStatusSummaryOutput[];
}) {
  const [openStatusId, setOpenStatusId] = useState<StatusDefinition["id"] | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRefs = useRef<Partial<Record<StatusDefinition["id"], HTMLButtonElement | null>>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpenStatusId(null);
    setMenuPosition(null);
  }, [clearCloseTimer]);

  const scheduleMenuClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpenStatusId(null);
      setMenuPosition(null);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const updateMenuPosition = useCallback(() => {
    if (!openStatusId) return;
    const trigger = triggerRefs.current[openStatusId];
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const availableHeight = Math.max(0, window.innerHeight - (VIEWPORT_GUTTER * 2));
    const menuHeight = Math.min(menuRef.current?.offsetHeight ?? MENU_MAX_HEIGHT, MENU_MAX_HEIGHT, availableHeight);
    const preferredTop = triggerRect.bottom + MENU_GAP;
    const canOpenBelow = preferredTop + menuHeight <= window.innerHeight - VIEWPORT_GUTTER;
    const top = canOpenBelow
      ? preferredTop
      : Math.max(VIEWPORT_GUTTER, triggerRect.top - MENU_GAP - menuHeight);
    const left = clamp(
      triggerRect.left + (triggerRect.width / 2) - (MENU_WIDTH / 2),
      VIEWPORT_GUTTER,
      Math.max(VIEWPORT_GUTTER, window.innerWidth - MENU_WIDTH - VIEWPORT_GUTTER),
    );
    setMenuPosition({ left, top });
  }, [openStatusId]);

  const openMenu = useCallback((statusId: StatusDefinition["id"]) => {
    clearCloseTimer();
    setOpenStatusId(statusId);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!openStatusId) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openStatusId, updateMenuPosition]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return <div aria-label="İçerik üretim özeti" className="mt-4 flex flex-wrap justify-center gap-2">
    {STATUS_DEFINITIONS.map((definition) => {
      const generators = generatorCounts(outputs, definition);
      const count = generators.reduce((total, item) => total + item.count, 0);
      const Icon = definition.icon;
      const menuId = `automation-status-${definition.id}`;
      const isOpen = openStatusId === definition.id;
      return <div key={definition.id} onMouseEnter={() => openMenu(definition.id)} onMouseLeave={scheduleMenuClose}>
        <button
          aria-controls={isOpen ? menuId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`${definition.label}: ${count} içerik`}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", definition.buttonClassName)}
          onBlur={scheduleMenuClose}
          onClick={() => isOpen ? closeMenu() : openMenu(definition.id)}
          onFocus={() => openMenu(definition.id)}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
          ref={(node) => {
            triggerRefs.current[definition.id] = node;
          }}
          type="button"
        >
          <Icon aria-hidden="true" className={cn("size-3.5", definition.iconClassName)} />
          <span>{count}</span>
        </button>
        {isOpen && typeof document !== "undefined" ? createPortal(<div
          aria-label={`${definition.label} içerikler`}
          className={cn("fixed z-[10000] w-72 max-h-80 overflow-y-auto overscroll-contain rounded border p-2 text-left text-[11px] leading-4 shadow-sm", definition.menuClassName)}
          id={menuId}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleMenuClose}
          ref={menuRef}
          role="dialog"
          style={menuPosition ? { left: menuPosition.left, top: menuPosition.top } : { left: VIEWPORT_GUTTER, top: VIEWPORT_GUTTER, visibility: "hidden" }}
          tabIndex={-1}
        >
          <p className="font-semibold">{definition.label} içerikler</p>
          {generators.length ? <ul className="mt-1.5 space-y-1.5">{generators.map(({ generator, count: generatorCount, errorCodes }) => <li className="flex items-start justify-between gap-3" key={generator}><div className="min-w-0"><p className="leading-4">{labelForGenerator(generator)}</p>{definition.id === "failed" && errorCodes.length ? <p className="mt-0.5 break-words text-current/75">Hata: {errorCodes.join(" · ")}</p> : null}</div><span className="shrink-0 font-semibold">{generatorCount} adet</span></li>)}</ul> : <p className="mt-1 text-current/75">Bu statüde içerik yok.</p>}
        </div>, document.body) : null}
      </div>;
    })}
  </div>;
}
