"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import { X } from "lucide-react";
import type { Area } from "react-easy-crop";
import { useT } from "@/i18n/locale-provider";

interface MobileImageCropSheetProps {
  open: boolean;
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (cropArea: Area) => void | Promise<void>;
}

type CropHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NaturalImageSize {
  width: number;
  height: number;
}

interface DisplayImageBounds extends NaturalImageSize {
  left: number;
  top: number;
}

interface ActiveHandleDrag {
  handle: CropHandle;
  pointerId: number;
}

const FULL_IMAGE_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP_SIZE_PX = 44;
const IMAGE_VIEWPORT_INSET_PX = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getResizedCropRect(
  current: CropRect,
  handle: CropHandle,
  point: { x: number; y: number },
  imageBounds: DisplayImageBounds,
): CropRect {
  const left = current.x;
  const top = current.y;
  const right = current.x + current.width;
  const bottom = current.y + current.height;
  const minWidth = Math.min(1, MIN_CROP_SIZE_PX / imageBounds.width);
  const minHeight = Math.min(1, MIN_CROP_SIZE_PX / imageBounds.height);

  switch (handle) {
    case "top-left": {
      const nextLeft = clamp(point.x, 0, right - minWidth);
      const nextTop = clamp(point.y, 0, bottom - minHeight);
      return {
        x: nextLeft,
        y: nextTop,
        width: right - nextLeft,
        height: bottom - nextTop,
      };
    }
    case "top-right": {
      const nextRight = clamp(point.x, left + minWidth, 1);
      const nextTop = clamp(point.y, 0, bottom - minHeight);
      return {
        x: left,
        y: nextTop,
        width: nextRight - left,
        height: bottom - nextTop,
      };
    }
    case "bottom-left": {
      const nextLeft = clamp(point.x, 0, right - minWidth);
      const nextBottom = clamp(point.y, top + minHeight, 1);
      return {
        x: nextLeft,
        y: top,
        width: right - nextLeft,
        height: nextBottom - top,
      };
    }
    case "bottom-right": {
      const nextRight = clamp(point.x, left + minWidth, 1);
      const nextBottom = clamp(point.y, top + minHeight, 1);
      return {
        x: left,
        y: top,
        width: nextRight - left,
        height: nextBottom - top,
      };
    }
  }
}

function getHandleClassName(handle: CropHandle) {
  switch (handle) {
    case "top-left":
      return "left-0 top-0";
    case "top-right":
      return "right-0 top-0";
    case "bottom-left":
      return "bottom-0 left-0";
    case "bottom-right":
      return "bottom-0 right-0";
  }
}

function getHandleGlyphClassName(handle: CropHandle) {
  switch (handle) {
    case "top-left":
      return "left-0 top-0 rounded-tl-md border-l-4 border-t-4";
    case "top-right":
      return "right-0 top-0 rounded-tr-md border-r-4 border-t-4";
    case "bottom-left":
      return "bottom-0 left-0 rounded-bl-md border-b-4 border-l-4";
    case "bottom-right":
      return "bottom-0 right-0 rounded-br-md border-b-4 border-r-4";
  }
}

const CROP_HANDLES: CropHandle[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export function MobileImageCropSheet({
  open,
  imageUrl,
  onCancel,
  onConfirm,
}: MobileImageCropSheetProps) {
  const t = useT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<ActiveHandleDrag | null>(null);
  const [naturalSize, setNaturalSize] = useState<NaturalImageSize | null>(null);
  const [imageBounds, setImageBounds] = useState<DisplayImageBounds | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>(FULL_IMAGE_CROP);
  const [confirming, setConfirming] = useState(false);

  const updateImageBounds = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !naturalSize) return;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (!viewportWidth || !viewportHeight) return;

    const availableWidth = Math.max(1, viewportWidth - IMAGE_VIEWPORT_INSET_PX * 2);
    const availableHeight = Math.max(1, viewportHeight - IMAGE_VIEWPORT_INSET_PX * 2);
    const scale = Math.min(availableWidth / naturalSize.width, availableHeight / naturalSize.height);
    const width = naturalSize.width * scale;
    const height = naturalSize.height * scale;

    setImageBounds({
      left: (viewportWidth - width) / 2,
      top: (viewportHeight - height) / 2,
      width,
      height,
    });
  }, [naturalSize]);

  useEffect(() => {
    if (!naturalSize || !viewportRef.current) return;

    updateImageBounds();
    const resizeObserver = new ResizeObserver(updateImageBounds);
    resizeObserver.observe(viewportRef.current);
    return () => resizeObserver.disconnect();
  }, [naturalSize, updateImageBounds]);

  const selectedCropArea: Area | null = naturalSize
    ? {
        x: Math.round(cropRect.x * naturalSize.width),
        y: Math.round(cropRect.y * naturalSize.height),
        width: Math.max(1, Math.round(cropRect.width * naturalSize.width)),
        height: Math.max(1, Math.round(cropRect.height * naturalSize.height)),
      }
    : null;

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
  }

  function getNormalizedPoint(event: PointerEvent<HTMLButtonElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !imageBounds) return null;

    const viewportBounds = viewport.getBoundingClientRect();
    return {
      x: clamp(
        (event.clientX - viewportBounds.left - imageBounds.left) / imageBounds.width,
        0,
        1,
      ),
      y: clamp(
        (event.clientY - viewportBounds.top - imageBounds.top) / imageBounds.height,
        0,
        1,
      ),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, handle: CropHandle) {
    if (event.button !== 0 || !imageBounds) return;

    event.preventDefault();
    event.stopPropagation();
    activeDragRef.current = { handle, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const activeDrag = activeDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId || !imageBounds) return;

    const point = getNormalizedPoint(event);
    if (!point) return;

    event.preventDefault();
    setCropRect((current) => getResizedCropRect(current, activeDrag.handle, point, imageBounds));
  }

  function finishPointerDrag(event: PointerEvent<HTMLButtonElement>) {
    if (activeDragRef.current?.pointerId !== event.pointerId) return;

    activeDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleConfirm() {
    if (!selectedCropArea || confirming) return;

    setConfirming(true);
    try {
      await onConfirm(selectedCropArea);
    } finally {
      setConfirming(false);
    }
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  const selectionStyle = imageBounds
    ? {
        left: imageBounds.left + cropRect.x * imageBounds.width,
        top: imageBounds.top + cropRect.y * imageBounds.height,
        width: cropRect.width * imageBounds.width,
        height: cropRect.height * imageBounds.height,
      }
    : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-[1300] flex min-h-[100dvh] flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("imageTranslate.cropTitle")}
      data-image-crop-dialog
    >
      <header className="flex shrink-0 items-center justify-between bg-black px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          aria-label={t("common.close")}
          className="inline-flex size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="size-6" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <span className="sr-only">{t("imageTranslate.cropTitle")}</span>
        <span className="size-11" aria-hidden="true" />
      </header>

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {/* The cropper needs the raw image dimensions and direct pointer-aligned sizing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={t("imageTranslate.cropTitle")}
          onLoad={handleImageLoad}
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={
            imageBounds
              ? {
                  left: imageBounds.left,
                  top: imageBounds.top,
                  width: imageBounds.width,
                  height: imageBounds.height,
                }
              : { visibility: "hidden" }
          }
        />

        {imageBounds && (
          <div
            className="pointer-events-none absolute shadow-[0_0_0_9999px_rgb(0_0_0_/_0.72)]"
            style={selectionStyle}
            data-crop-selection
          >
            {CROP_HANDLES.map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={t("imageTranslate.cropTitle")}
                className={`pointer-events-auto absolute size-11 touch-none select-none ${getHandleClassName(handle)}`}
                onPointerDown={(event) => handlePointerDown(event, handle)}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerDrag}
                onPointerCancel={finishPointerDrag}
                onLostPointerCapture={finishPointerDrag}
              >
                <span
                  className={`pointer-events-none absolute size-7 border-white ${getHandleGlyphClassName(handle)}`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 bg-black px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!selectedCropArea || confirming}
          aria-busy={confirming}
          className="mx-auto flex h-12 w-full max-w-md items-center justify-center rounded-xl bg-transparent px-4 text-base font-bold text-white transition-colors hover:bg-white/10 active:scale-[0.99] disabled:cursor-wait disabled:opacity-50"
        >
          {t("imageTranslate.cropConfirm")}
        </button>
      </footer>
    </div>,
    document.body,
  );
}
