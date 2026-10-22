"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { LoaderCircle, RotateCcw, RotateCw, Shuffle } from "lucide-react";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { CardDesignReferencePreview } from "@/features/cards/components/card-design-reference-preview";
import type { CardDesignTestSample } from "@/features/cards/card-design-test-sample";

type CardDimensions = { width: number; height: number };
type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type ActiveResize = {
  pointerId: number;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_DIMENSIONS: CardDimensions = { width: 320, height: 456 };
const MIN_WIDTH = 140;
const MAX_WIDTH = 1_000;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 1_200;
const INITIAL_SAMPLE: CardDesignTestSample = {
  cardId: "reference-card",
  learningLanguage: "ja",
  nativeLanguage: "en",
  tier: "B1",
  term: "経済",
  translation: "economy",
  partOfSpeech: "noun",
  pronunciation: "keizai",
  example: "最近、経済が少し\n不安です。",
};

const RESIZE_CORNERS: Array<{
  id: ResizeCorner;
  position: string;
  cursor: string;
}> = [
  { id: "top-left", position: "-left-3 -top-3", cursor: "cursor-nwse-resize" },
  { id: "top-right", position: "-right-3 -top-3", cursor: "cursor-nesw-resize" },
  { id: "bottom-left", position: "-bottom-3 -left-3", cursor: "cursor-nesw-resize" },
  { id: "bottom-right", position: "-bottom-3 -right-3", cursor: "cursor-nwse-resize" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getAspectRatio({ width, height }: CardDimensions) {
  return (width / height).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function CardDesignTestScreen() {
  const [sample, setSample] = useState(INITIAL_SAMPLE);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizeError, setRandomizeError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showCardBack, setShowCardBack] = useState(false);
  const [widthDraft, setWidthDraft] = useState(String(DEFAULT_DIMENSIONS.width));
  const [heightDraft, setHeightDraft] = useState(String(DEFAULT_DIMENSIONS.height));
  const activeResize = useRef<ActiveResize | null>(null);
  const aspectRatio = getAspectRatio(dimensions);

  function startResize(corner: ResizeCorner, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activeResize.current = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      width: dimensions.width,
      height: dimensions.height,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const resize = activeResize.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;
    const horizontalDirection = resize.corner.endsWith("left") ? -1 : 1;
    const verticalDirection = resize.corner.startsWith("top") ? -1 : 1;

    const nextWidth = clamp(resize.width + deltaX * horizontalDirection, MIN_WIDTH, MAX_WIDTH);
    const nextHeight = clamp(resize.height + deltaY * verticalDirection, MIN_HEIGHT, MAX_HEIGHT);
    setDimensions({ width: nextWidth, height: nextHeight });
    setWidthDraft(String(nextWidth));
    setHeightDraft(String(nextHeight));
    // Move the center by half the pointer delta so the opposite corner stays put.
    setOffset({ x: resize.offsetX + deltaX / 2, y: resize.offsetY + deltaY / 2 });
  }

  function finishResize(event: PointerEvent<HTMLButtonElement>) {
    if (activeResize.current?.pointerId === event.pointerId) activeResize.current = null;
  }

  function resizeWithKeyboard(corner: ResizeCorner, event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 24 : 8;
    let deltaX = 0;
    let deltaY = 0;
    if (event.key === "ArrowLeft") deltaX = -step;
    else if (event.key === "ArrowRight") deltaX = step;
    else if (event.key === "ArrowUp") deltaY = -step;
    else if (event.key === "ArrowDown") deltaY = step;
    else return;

    event.preventDefault();
    const horizontalDirection = corner.endsWith("left") ? -1 : 1;
    const verticalDirection = corner.startsWith("top") ? -1 : 1;
    const nextDimensions = {
      width: clamp(dimensions.width + deltaX * horizontalDirection, MIN_WIDTH, MAX_WIDTH),
      height: clamp(dimensions.height + deltaY * verticalDirection, MIN_HEIGHT, MAX_HEIGHT),
    };
    setDimensions(nextDimensions);
    setWidthDraft(String(nextDimensions.width));
    setHeightDraft(String(nextDimensions.height));
    setOffset((current) => ({ x: current.x + deltaX / 2, y: current.y + deltaY / 2 }));
  }

  function commitDimension(key: keyof CardDimensions, value: string) {
    const parsedValue = Number(value);
    const min = key === "width" ? MIN_WIDTH : MIN_HEIGHT;
    const max = key === "width" ? MAX_WIDTH : MAX_HEIGHT;
    const nextValue = clamp(Number.isFinite(parsedValue) ? parsedValue : min, min, max);
    setDimensions((current) => ({ ...current, [key]: nextValue }));
    if (key === "width") setWidthDraft(String(nextValue));
    else setHeightDraft(String(nextValue));
  }

  function reset() {
    setDimensions(DEFAULT_DIMENSIONS);
    setOffset({ x: 0, y: 0 });
    setWidthDraft(String(DEFAULT_DIMENSIONS.width));
    setHeightDraft(String(DEFAULT_DIMENSIONS.height));
  }

  async function randomizeCard() {
    setIsRandomizing(true);
    setRandomizeError(null);

    const params = new URLSearchParams({
      excludeCardId: sample.cardId,
      excludeLearningLanguage: sample.learningLanguage,
      excludeNativeLanguage: sample.nativeLanguage,
    });

    try {
      const response = await fetch(`/api/visual-test-card/random?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The random card request failed.");
      setSample(await response.json() as CardDesignTestSample);
    } catch {
      setRandomizeError("Could not load a random word. Try again.");
    } finally {
      setIsRandomizing(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] bg-[#12100e] px-3 py-5 text-[#f9f2e9] sm:px-6 sm:py-7">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#ffad55]">Reference card workspace</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Card design test</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c9bdb1]">
              Compare this reference design at different sizes and aspect ratios. Drag any corner to resize it freely.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1b1714] px-3 py-2 text-sm text-[#d7c9bc]" data-testid="card-current-language-summary">
              <span className="size-2 rounded-full bg-[#f59e0b]" aria-hidden="true" />
              {LANGUAGE_BY_CODE[sample.learningLanguage].name} · {sample.tier}
            </div>
            <button
              aria-busy={isRandomizing}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-[#21160b] transition-colors hover:bg-[#ffc05a] disabled:cursor-wait disabled:opacity-70"
              data-testid="randomize-card-button"
              disabled={isRandomizing}
              onClick={randomizeCard}
              type="button"
            >
              {isRandomizing ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Shuffle aria-hidden="true" className="size-4" />}
              {isRandomizing ? "Loading word" : "Randomize word"}
            </button>
          </div>
        </header>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Resizable card preview" className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d0b09]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-white">Preview</p>
                <p className="mt-0.5 text-xs text-[#9e9185]">Drag one of the four corner handles</p>
              </div>
              <button
                aria-pressed={showCardBack}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-xs font-semibold text-[#f9f2e9] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f59e0b]"
                data-testid="flip-card-button"
                onClick={() => setShowCardBack((current) => !current)}
                type="button"
              >
                <RotateCw aria-hidden="true" className="size-4" />
                {showCardBack ? "Show card front" : "Show card back"}
              </button>
            </div>

            <div className="overflow-auto">
              <div
                data-testid="card-preview-canvas"
                className="relative grid min-h-[580px] place-items-center"
                style={{
                  width: `max(100%, ${dimensions.width + 64}px)`,
                  height: `max(580px, ${dimensions.height + 128}px)`,
                  backgroundColor: "#000000",
                }}
              >
                <div
                  className="absolute"
                  data-testid="card-preview-frame"
                  style={{
                    width: dimensions.width,
                    height: dimensions.height,
                    left: "50%",
                    top: "50%",
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                >
                  <CardDesignReferencePreview sample={sample} showBack={showCardBack} />
                  {RESIZE_CORNERS.map((corner) => (
                    <button
                      aria-label={`Resize card from ${corner.id.replaceAll("-", " ")}`}
                      className={`absolute ${corner.position} z-10 size-6 touch-none rounded-full border-2 border-[#f59e0b] bg-white shadow-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#f59e0b] ${corner.cursor}`}
                      data-resize-corner={corner.id}
                      key={corner.id}
                      onKeyDown={(event) => resizeWithKeyboard(corner.id, event)}
                      onLostPointerCapture={finishResize}
                      onPointerCancel={finishResize}
                      onPointerDown={(event) => startResize(corner.id, event)}
                      onPointerMove={moveResize}
                      onPointerUp={finishResize}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-xl border border-white/10 bg-[#1b1714] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Dimensions</h2>
                <p className="mt-1 text-xs leading-5 text-[#a99b8f]">Resize by dragging or enter exact pixel values.</p>
              </div>
              <button
                aria-label="Reset card size"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-[#e7d9ca] transition-colors hover:bg-white/10 hover:text-white"
                onClick={reset}
                title="Reset to 320 x 456"
                type="button"
              >
                <RotateCcw aria-hidden="true" className="size-4" />
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-[#9e9185]">Learning language</dt>
                <dd className="mt-1 font-semibold text-white" data-language={sample.learningLanguage} data-testid="card-learning-language">
                  {LANGUAGE_BY_CODE[sample.learningLanguage].name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#9e9185]">Native language</dt>
                <dd className="mt-1 font-semibold text-white" data-language={sample.nativeLanguage} data-testid="card-native-language">
                  {LANGUAGE_BY_CODE[sample.nativeLanguage].name}
                </dd>
              </div>
            </dl>

            {randomizeError ? <p className="mt-3 text-sm text-[#ff9a86]" role="alert">{randomizeError}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-[#cdbfb3]" htmlFor="card-test-width">
                Width (px)
                <input
                  className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#100d0b] px-3 text-sm text-white outline-none focus:border-[#f59e0b]"
                  id="card-test-width"
                  max={MAX_WIDTH}
                  min={MIN_WIDTH}
                  onBlur={(event) => commitDimension("width", event.currentTarget.value)}
                  onChange={(event) => setWidthDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  type="number"
                  value={widthDraft}
                />
              </label>
              <label className="block text-xs font-semibold text-[#cdbfb3]" htmlFor="card-test-height">
                Height (px)
                <input
                  className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#100d0b] px-3 text-sm text-white outline-none focus:border-[#f59e0b]"
                  id="card-test-height"
                  max={MAX_HEIGHT}
                  min={MIN_HEIGHT}
                  onBlur={(event) => commitDimension("height", event.currentTarget.value)}
                  onChange={(event) => setHeightDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  type="number"
                  value={heightDraft}
                />
              </label>
            </div>

            <dl className="mt-5 grid grid-cols-2 divide-x divide-white/10 rounded-lg bg-[#100d0b] py-3">
              <div className="px-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9e9185]">Aspect ratio</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-white" data-testid="card-aspect-ratio">{aspectRatio}</dd>
              </div>
              <div className="px-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9e9185]">Size</dt>
                <dd className="mt-1 text-sm font-semibold text-white" data-testid="card-size">{dimensions.width} x {dimensions.height}</dd>
              </div>
            </dl>

            <p className="mt-4 text-xs leading-5 text-[#a99b8f]">
              Use the corner handles with a mouse or touch. Focus a handle and use arrow keys to resize; hold Shift for larger steps.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
