"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { Check, X, ZoomIn } from "lucide-react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { useT } from "@/i18n/locale-provider";

interface MobileImageCropSheetProps {
  open: boolean;
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (cropArea: Area) => void | Promise<void>;
}

export function MobileImageCropSheet({
  open,
  imageUrl,
  onCancel,
  onConfirm,
}: MobileImageCropSheetProps) {
  const t = useT();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropAreaPixels, setCropAreaPixels] = useState<Area | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!open || typeof document === "undefined") {
    return null;
  }

  async function handleConfirm() {
    if (!cropAreaPixels || confirming) return;

    setConfirming(true);
    try {
      await onConfirm(cropAreaPixels);
    } finally {
      setConfirming(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1300] flex min-h-[100dvh] flex-col bg-[#111716] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("imageTranslate.cropTitle")}
      data-image-crop-dialog
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          aria-label={t("common.close")}
          className="inline-flex size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <h2 className="text-lg font-semibold">{t("imageTranslate.cropTitle")}</h2>
        <span className="size-11" aria-hidden="true" />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#111716]">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={4 / 3}
          minZoom={1}
          maxZoom={5}
          objectFit="cover"
          restrictPosition
          showGrid
          cropShape="rect"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, areaPixels) => setCropAreaPixels(areaPixels)}
          classes={{
            containerClassName: "!bg-[#111716]",
            cropAreaClassName: "border-2 border-white",
          }}
          style={{
            cropAreaStyle: {
              boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.58)",
            },
          }}
          mediaProps={{ alt: t("imageTranslate.cropTitle") }}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        <p className="mx-auto max-w-md text-center text-sm leading-5 text-white/70">
          {t("imageTranslate.cropHint")}
        </p>
        <label className="mx-auto mt-4 flex max-w-md items-center gap-3 text-sm font-semibold text-white/85">
          <ZoomIn className="size-5 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t("imageTranslate.cropZoom")}</span>
          <input
            type="range"
            min="1"
            max="5"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t("imageTranslate.cropZoom")}
            className="min-w-0 flex-1 accent-white"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!cropAreaPixels || confirming}
          className="mx-auto mt-4 flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-bold text-slate-950 transition-colors hover:bg-white/90 active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
        >
          {confirming ? <ZoomIn className="size-5 animate-pulse" aria-hidden="true" /> : <Check className="size-5" aria-hidden="true" />}
          {t("imageTranslate.cropConfirm")}
        </button>
      </footer>
    </div>,
    document.body,
  );
}
