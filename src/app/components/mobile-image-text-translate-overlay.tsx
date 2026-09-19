"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Loader2, ScanText, Type, Upload, X } from "lucide-react";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { MobileCustomCardLanguagePicker } from "@/app/components/mobile-custom-card-language-picker";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { findCustomCardMatch } from "@/features/cards/custom-card-matching";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import type {
  ImageTextMode,
  ImageTextTranslationEntry,
  ImageTextTranslateResponse,
} from "@/features/cards/image-text-translate-schema";
import { imageTextTranslateResponseSchema } from "@/features/cards/image-text-translate-schema";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { LanguageCode, LimitErrorCode } from "@/types/domain";

const MAX_UPLOAD_IMAGES = 6;
const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
}

type EntryStatus = "idle" | "adding" | "added" | "error";

interface MobileImageTextTranslateOverlayProps {
  open: boolean;
  onClose: () => void;
  targetLanguage: LanguageCode;
  onSubscriptionLimitReached?: (errorCode: LimitErrorCode) => void;
}

export function MobileImageTextTranslateOverlay({
  open,
  onClose,
  targetLanguage: landingLanguage,
  onSubscriptionLimitReached,
}: MobileImageTextTranslateOverlayProps) {
  const t = useT();
  const { locale } = useLocale();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);
  const addCard = useInventoryStore((state) => state.addCard);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(landingLanguage);
  const [mode, setMode] = useState<ImageTextMode>("image");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<ImageTextTranslationEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [entryStatuses, setEntryStatuses] = useState<Record<string, EntryStatus>>({});
  const [loading, setLoading] = useState(false);
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [addingSelected, setAddingSelected] = useState(false);
  const [errorCode, setErrorCode] = useState("");
  const [entryError, setEntryError] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const stopAddingOnLimitRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setMode("image");
      setImages([]);
      setText("");
      setEntries([]);
      setSelectedIds(new Set());
      setEntryStatuses({});
      setLoading(false);
      setPendingImageCount(0);
      setAddingSelected(false);
      setErrorCode("");
      setEntryError("");
      return;
    }

    if (wasOpenRef.current) return;

    wasOpenRef.current = true;
    setTargetLanguage(landingLanguage);
  }, [landingLanguage, open]);

  function handleClose() {
    onClose();
  }

  async function handleFileSelection(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || pendingImageCount > 0) return;

    const availableSlots = MAX_UPLOAD_IMAGES - images.length;
    if (availableSlots <= 0) {
      setErrorCode("image_limit");
      return;
    }

    const files = Array.from(fileList).slice(0, availableSlots);
    setPendingImageCount(files.length);
    setErrorCode("");

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") || file.size > MAX_FILE_SIZE_BYTES) {
          setErrorCode("invalid_image");
          setPendingImageCount((current) => Math.max(0, current - 1));
          continue;
        }

        try {
          const dataUrl = await imageFileToDataUrl(file);
          setImages((current) => [
            ...current,
            { id: createClientId(), name: file.name, dataUrl },
          ].slice(0, MAX_UPLOAD_IMAGES));
        } catch {
          setErrorCode("invalid_image");
        } finally {
          setPendingImageCount((current) => Math.max(0, current - 1));
        }
      }
    } finally {
      setPendingImageCount(0);
    }
  }

  function removeImage(id: string) {
    setImages((current) => current.filter((image) => image.id !== id));
  }

  async function handleGenerate() {
    if (loading) return;

    if (mode === "image" && images.length === 0) {
      setErrorCode("no_images");
      return;
    }

    if (mode === "text" && !text.trim()) {
      setErrorCode("no_text");
      return;
    }

    setLoading(true);
    setErrorCode("");
    setEntryError("");
    setEntries([]);
    setSelectedIds(new Set());
    setEntryStatuses({});

    try {
      const requestImages = mode === "image" ? images.map((image) => image.dataUrl) : undefined;
      if (mode === "image") {
        setImages([]);
      }
      const response = await fetch("/api/cards/image-text-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          locale,
          targetLanguage,
          text: mode === "text" ? text.trim() : undefined,
          images: requestImages,
        }),
      });
      const payload = await response.json().catch(() => ({ errorCode: "unknown" }));

      if (!response.ok) {
        throw new Error(payload.errorCode ?? "unknown");
      }

      const parsedResult = imageTextTranslateResponseSchema.safeParse(payload);
      if (!parsedResult.success) {
        throw new Error("upstream_error");
      }
      const result: ImageTextTranslateResponse = parsedResult.data;
      setEntries(result.entries);
      setEntryStatuses(Object.fromEntries(result.entries.map((entry) => [entry.id, "idle"] as const)));
    } catch (error) {
      setErrorCode(getErrorCode(error));
    } finally {
      setLoading(false);
    }
  }

  function toggleEntry(entryId: string) {
    if (entryStatuses[entryId] === "added" || entryStatuses[entryId] === "adding") return;

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  async function addEntry(entry: ImageTextTranslationEntry): Promise<boolean> {
    setEntryError("");
    setEntryStatuses((current) => ({ ...current, [entry.id]: "adding" }));

    try {
      const existingCard = findCustomCardMatch({
        cards: [
          ...localCardRepository.list({ language: targetLanguage }),
          ...customCardRegistry.list(),
        ],
        term: entry.source,
        inputLanguage: locale,
        targetLanguage,
        direction: "learning-to-native",
      });

      if (existingCard) {
        if (!useInventoryStore.getState().cards.some((card) => card.cardId === existingCard.sourceKey)) {
          const result = await addCard(existingCard.sourceKey);
          if (!result.ok) {
            throw new InventoryActionError(
              result.limitReached ? "free_active_card_limit" : "unknown",
              result.limitReached ? "free_active_card_limit" : undefined,
            );
          }
        }
      } else {
        const generated = await generateCardRequest({
          locale,
          term: entry.source,
          targetLanguage,
          direction: "learning-to-native",
        });
        const optimisticSourceKey = createPendingSourceKey();
        await createCustomCard({
          language: generated.language,
          tier: generated.tier,
          termKind: generated.termKind,
          draft: toGeneratedCardDraft(generated),
          optimisticCard: {
            ...buildPreviewVocabularyCard(generated),
            id: optimisticSourceKey,
            sourceKey: optimisticSourceKey,
          },
        });
      }

      setEntryStatuses((current) => ({ ...current, [entry.id]: "added" }));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
      return true;
    } catch (error) {
      const limitError = getLimitErrorCode(error);
      if (limitError) {
        stopAddingOnLimitRef.current = true;
        onSubscriptionLimitReached?.(limitError);
      }
      setEntryStatuses((current) => ({ ...current, [entry.id]: "error" }));
      setEntryError(getAddErrorMessage(error, t));
      return false;
    }
  }

  async function addSelectedEntries() {
    if (addingSelected) return;

    const selectedEntries = entries.filter((entry) => selectedIds.has(entry.id));
    if (selectedEntries.length === 0) return;

    setAddingSelected(true);
    stopAddingOnLimitRef.current = false;
    for (const entry of selectedEntries) {
      const added = await addEntry(entry);
      if (!added && stopAddingOnLimitRef.current) break;
    }
    setAddingSelected(false);
  }

  const selectedCount = [...selectedIds].filter((id) => entryStatuses[id] !== "added").length;
  const hasInput = mode === "image" ? images.length > 0 : text.trim().length > 0;

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={handleClose}
      title={t("imageTranslate.title")}
      panelLabel={t("imageTranslate.title")}
      visual={<ScanText className="size-10" aria-hidden="true" />}
      fullScreen
      showPanelDecoration={false}
      showBackdrop={false}
      panelClassName="image-text-translate-surface bg-background text-foreground"
      contentClassName="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-4">
        <p className="text-center text-sm leading-5 text-foreground-secondary">
          {t("imageTranslate.description")}
        </p>

        <SegmentedToggle
          value={mode}
          onChange={setMode}
          className="control-gradient-outline image-text-translate-plain-outline w-full border-border bg-background-card [&>button]:flex-1"
          selectedClassName="bg-background-inverse !text-foreground-inverse hover:brightness-110"
          labelClassName="text-foreground-secondary transition-colors duration-300"
          ariaLabel={t("imageTranslate.modeLabel")}
          optionProps={(value) => ({
            "data-image-text-mode": value,
            "aria-label": formatSuperWaterText(
              locale,
              t(value === "image" ? "imageTranslate.imageMode" : "imageTranslate.textMode"),
            ),
          })}
          options={[
            { value: "image", label: <ImageIcon className="mx-auto size-6" aria-hidden="true" /> },
            { value: "text", label: <Type className="mx-auto size-6" aria-hidden="true" /> },
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">
            {t("imageTranslate.scanLanguageTitle")}
          </p>
          <MobileCustomCardLanguagePicker
            value={targetLanguage}
            onChange={setTargetLanguage}
            className="image-text-translate-plain-outline !text-white"
          />
        </div>

        {mode === "image" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={pendingImageCount > 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background-card px-3 text-sm font-semibold text-foreground transition-transform active:scale-[0.98]"
              >
                <Camera className="size-5" aria-hidden="true" />
                {t("imageTranslate.camera")}
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={pendingImageCount > 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background-card px-3 text-sm font-semibold text-foreground transition-transform active:scale-[0.98]"
              >
                <Upload className="size-5" aria-hidden="true" />
                {t("imageTranslate.gallery")}
              </button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void handleFileSelection(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleFileSelection(event.target.files);
                event.currentTarget.value = "";
              }}
            />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-foreground">
                {t("imageTranslate.uploadedImages", { count: images.length, max: MAX_UPLOAD_IMAGES })}
              </p>
              {images.length > 0 || pendingImageCount > 0 ? (
                <div
                  className="grid grid-cols-3 gap-2"
                  aria-label={t("imageTranslate.uploadedImages", { count: images.length, max: MAX_UPLOAD_IMAGES })}
                >
                  {Array.from({ length: pendingImageCount }, (_, index) => (
                    <div
                      key={`pending-image-${index}`}
                      role="status"
                      aria-label={t("imageTranslate.loadingImage")}
                      className="relative aspect-square overflow-hidden rounded-xl border-2 border-dashed border-border bg-background-muted"
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-foreground-secondary">
                        <Loader2 className="size-7 animate-spin" aria-hidden="true" />
                      </span>
                    </div>
                  ))}
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => removeImage(image.id)}
                      aria-label={`${t("imageTranslate.removeImage")}: ${image.name}`}
                      className="group relative aspect-square overflow-hidden rounded-xl border-2 border-background-card bg-background-muted shadow-sm transition-transform active:scale-95"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.dataUrl} alt={image.name} className="size-full object-contain" />
                      <span className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background-inverse/80 text-foreground-inverse">
                        <X className="size-4" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background-card/60 px-4 py-7 text-center text-sm text-foreground-secondary">
                  {t("imageTranslate.noImages")}
                </div>
              )}
            </div>
          </>
        ) : (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={4000}
            placeholder={t("imageTranslate.textPlaceholder")}
            className="control-gradient-outline min-h-40 w-full resize-none rounded-2xl border-border bg-background-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground-muted"
          />
        )}

        {errorCode ? <p role="alert" className="rounded-xl border border-tier-c1/30 bg-tier-c1/10 px-3 py-2 text-sm text-tier-c1-text">{getErrorMessage(errorCode, t)}</p> : null}

        <div className="mobile-primary-action-depth mobile-primary-action-depth--brand w-full rounded-xl">
          <button
            type="button"
            disabled={!hasInput || loading}
            onClick={handleGenerate}
            aria-busy={loading}
            className="image-text-translate-primary-action flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-[var(--brand)] px-4 text-base font-bold text-white transition-colors active:scale-[0.98] hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ScanText className="size-5" aria-hidden="true" />}
            {loading ? t("imageTranslate.generating") : t("imageTranslate.generate")}
          </button>
        </div>

        {entries.length > 0 ? (
          <section className="mt-2 flex flex-col gap-2" aria-labelledby="image-translate-results-title">
            <div className="flex items-center justify-between gap-3">
                <h3 id="image-translate-results-title" className={cn("text-lg font-bold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
                  {formatSuperWaterText(locale, t("imageTranslate.detectedWords"))}
                </h3>
              <span className="text-xs text-foreground-secondary">{entries.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {entries.map((entry) => {
                const status = entryStatuses[entry.id] ?? "idle";
                const selected = selectedIds.has(entry.id);
                return (
                  <div key={entry.id} className="rounded-xl border border-border bg-background-card/80 p-3 text-left shadow-sm">
                    <button
                      type="button"
                      onClick={() => toggleEntry(entry.id)}
                      aria-pressed={selected}
                      disabled={status === "added" || status === "adding"}
                      className="flex w-full items-start gap-3 text-left disabled:cursor-default"
                    >
                      <span className={cn("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors", selected || status === "added" ? "border-background-inverse bg-background-inverse text-foreground-inverse" : "border-foreground-muted text-transparent")}>
                        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-foreground">{entry.source}</span>
                        <span className="mt-0.5 block text-sm text-foreground-secondary">{entry.translation}</span>
                        <span className="mt-1 block text-xs leading-5 text-foreground-secondary">{entry.meaning}</span>
                      </span>
                    </button>
                    {status === "added" ? (
                      <p className="mt-2 pl-9 text-xs font-semibold text-tier-a1-text">{t("imageTranslate.added")}</p>
                    ) : (
                      <button
                        type="button"
                        disabled={status === "adding" || addingSelected}
                        onClick={() => void addEntry(entry)}
                        className="mt-2 ml-9 inline-flex h-9 items-center gap-2 rounded-full bg-background-inverse px-3 text-xs font-semibold text-foreground-inverse disabled:opacity-60"
                      >
                        {status === "adding" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                        {status === "adding" ? t("imageTranslate.adding") : t("imageTranslate.add")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {entryError ? <p role="alert" className="rounded-xl border border-tier-c1/30 bg-tier-c1/10 px-3 py-2 text-sm text-tier-c1-text">{entryError}</p> : null}

            <button
              type="button"
              disabled={selectedCount === 0 || addingSelected}
              onClick={() => void addSelectedEntries()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-background-inverse text-sm font-semibold text-foreground-inverse disabled:cursor-not-allowed disabled:opacity-40"
            >
              {addingSelected ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
              {t("imageTranslate.addSelected", { count: selectedCount })}
            </button>
          </section>
        ) : null}
      </div>
    </MobileBottomSheetShell>
  );
}

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPendingSourceKey() {
  return `pending-image-card:${createClientId()}`;
}

function imageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("invalid_image"));
    reader.onload = () => {
      const source = typeof reader.result === "string" ? reader.result : "";
      if (!source) {
        reject(new Error("invalid_image"));
        return;
      }

      const image = new window.Image();
      image.onerror = () => reject(new Error("invalid_image"));
      image.onload = () => {
        const maxDimension = 1800;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("invalid_image"));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function toGeneratedCardDraft(generated: GeneratedCardResponse) {
  return {
    term: generated.term,
    partOfSpeech: generated.partOfSpeech,
    pronunciation: generated.pronunciation,
    translations: generated.translations,
    example: generated.example,
    exampleTranslation: generated.exampleTranslation,
    definitions: generated.definitions,
    grammar: generated.grammar,
    termKind: generated.termKind,
  };
}

function getErrorCode(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message.trim() : "unknown";
}

function getLimitErrorCode(error: unknown): LimitErrorCode | null {
  if (error instanceof InventoryActionError && error.errorCode) {
    return error.errorCode;
  }
  if (error instanceof Error && (error.message === "free_active_card_limit" || error.message === "free_learned_card_limit")) {
    return error.message;
  }
  return null;
}

function getAddErrorMessage(error: unknown, t: ReturnType<typeof useT>) {
  const limitError = getLimitErrorCode(error);
  if (limitError) return t("createCard.error.addFailed");
  if (error instanceof Error && error.message in IMAGE_TRANSLATE_ERROR_CODES) {
    return getErrorMessage(error.message, t);
  }
  return t("createCard.error.addFailed");
}

const IMAGE_TRANSLATE_ERROR_CODES: Record<string, true> = {
  ai_daily_limit: true,
  ai_monthly_limit: true,
  auth_required: true,
  invalid_request: true,
  no_text_detected: true,
  not_configured: true,
  unknown: true,
  upstream_error: true,
  usage_unavailable: true,
};

function formatErrorMessage(errorCode: string, t: ReturnType<typeof useT>) {
  const key = `imageTranslate.error.${errorCode}`;
  const message = t(key as never);
  return message === key ? t("imageTranslate.error.unknown") : message;
}

function getErrorMessage(errorCode: string, t: ReturnType<typeof useT>) {
  if (errorCode === "image_limit") return t("imageTranslate.error.imageLimit");
  if (errorCode === "invalid_image") return t("imageTranslate.error.invalidImage");
  if (errorCode === "no_images") return t("imageTranslate.error.noImages");
  if (errorCode === "no_text") return t("imageTranslate.error.noText");
  return formatErrorMessage(errorCode, t);
}
