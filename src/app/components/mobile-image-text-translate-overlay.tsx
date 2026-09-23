"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Camera, Check, Image as ImageIcon, Loader2, ScanText, Trash2, Type, Upload, X } from "lucide-react";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { MobileCustomCardLanguagePicker } from "@/app/components/mobile-custom-card-language-picker";
import { LanguageFlag } from "@/components/language-flag";
import { createCustomCardFromGenerated } from "@/features/cards/custom-card-creation";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import type {
  ImageTextMode,
  ImageTextSeparator,
  ImageTextSentencePair,
  ImageTextTranslateResponse,
} from "@/features/cards/image-text-translate-schema";
import { imageTextTranslateResponseSchema } from "@/features/cards/image-text-translate-schema";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import {
  deleteImageTextTranslationAction,
  getImageTextTranslationCountAction,
  getImageTextTranslationUsageAction,
  listImageTextTranslationsAction,
  saveImageTextTranslationAction,
  type SavedImageTextTranslation,
} from "@/features/cards/image-text-translate-actions";
import { getCardTranslationMeanings, getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { getTranslationPreview } from "@/features/cards/image-text-translate-utils";
import { useLocale, useT } from "@/i18n/locale-provider";
import { getLanguageDisplayName } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn, normalizeSearch } from "@/lib/utils";
import { useAppMessage } from "@/components/app-message-provider";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { ImageTextTranslationUsage } from "@/features/cards/image-text-translate-actions";
import type { LanguageCode, LimitErrorCode, Tier, VocabularyCard } from "@/types/domain";

const MAX_UPLOAD_IMAGES = 6;
const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_DATA_URL_LENGTH = 600_000;
const IMAGE_TEXT_TRANSLATE_OPENED_KEY = "foxiesdeck:image-text-translate-opened";
const IMAGE_TEXT_TRANSLATE_TUTORIAL_EXIT_MS = 860;

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
}

type WordStatus = "idle" | "loading" | "adding" | "added" | "error";
type ClickedLanguage = "source" | "native";

interface WordDetail {
  clickedWord: string;
  clickedLanguage: ClickedLanguage;
  sourceWord: string;
  translation: string;
  sentenceSource: string;
  sentenceTranslation: string;
  sentenceIndex: number;
  wordIndex: number;
  existingCard?: VocabularyCard;
  generatedCard?: GeneratedCardResponse;
}

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
  const { showMessage } = useAppMessage();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);
  const addCard = useInventoryStore((state) => state.addCard);
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>(landingLanguage);
  const [mode, setMode] = useState<ImageTextMode>("image");
  const [answerQuestions, setAnswerQuestions] = useState(true);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [text, setText] = useState("");
  const [detailTranslation, setDetailTranslation] = useState<SavedImageTextTranslation | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<"generated" | "saved">("generated");
  const [showTranslationDetail, setShowTranslationDetail] = useState(false);
  const [savedTranslations, setSavedTranslations] = useState<SavedImageTextTranslation[]>([]);
  const [savedTranslationCount, setSavedTranslationCount] = useState<number | null>(null);
  const [translationUsage, setTranslationUsage] = useState<ImageTextTranslationUsage | null>(null);
  const [showTranslationsList, setShowTranslationsList] = useState(false);
  const [translationsLoading, setTranslationsLoading] = useState(false);
  const [pendingDeleteTranslation, setPendingDeleteTranslation] = useState<SavedImageTextTranslation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null);
  const [wordStatus, setWordStatus] = useState<WordStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [showFirstOpenTutorial, setShowFirstOpenTutorial] = useState(false);
  const [isFirstOpenTutorialExiting, setIsFirstOpenTutorialExiting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const wordRequestIdRef = useRef(0);
  const firstOpenTutorialCloseTimerRef = useRef<number | null>(null);
  const confirmationCloseTimerRef = useRef<number | null>(null);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (firstOpenTutorialCloseTimerRef.current !== null) {
        window.clearTimeout(firstOpenTutorialCloseTimerRef.current);
        firstOpenTutorialCloseTimerRef.current = null;
      }
      if (confirmationCloseTimerRef.current !== null) {
        window.clearTimeout(confirmationCloseTimerRef.current);
        confirmationCloseTimerRef.current = null;
      }
      wasOpenRef.current = false;
      setMode("image");
      setAnswerQuestions(true);
      setImages([]);
      setText("");
      setDetailTranslation(null);
      setShowTranslationDetail(false);
      setShowTranslationsList(false);
      setSavedTranslations([]);
      setSavedTranslationCount(null);
      setTranslationUsage(null);
      setPendingDeleteTranslation(null);
      setWordDetail(null);
      setWordStatus("idle");
      setShowFirstOpenTutorial(false);
      setIsFirstOpenTutorialExiting(false);
      setLoading(false);
      setPendingImageCount(0);
      setConfirmationClosing(false);
      return;
    }

    if (wasOpenRef.current) return;

    wasOpenRef.current = true;
    setSourceLanguage(landingLanguage);
    void refreshTranslationCount();
    void refreshTranslationUsage();
    void refreshSavedTranslations();
    setIsFirstOpenTutorialExiting(false);
    const hasOpenedBefore = window.localStorage.getItem(IMAGE_TEXT_TRANSLATE_OPENED_KEY) === "true";
    if (!hasOpenedBefore) {
      window.localStorage.setItem(IMAGE_TEXT_TRANSLATE_OPENED_KEY, "true");
    }
    setShowFirstOpenTutorial(!hasOpenedBefore);
  }, [landingLanguage, open]);

  function handleFirstOpenTutorialContinue() {
    if (isFirstOpenTutorialExiting) return;

    setIsFirstOpenTutorialExiting(true);
    firstOpenTutorialCloseTimerRef.current = window.setTimeout(() => {
      firstOpenTutorialCloseTimerRef.current = null;
      setShowFirstOpenTutorial(false);
      setIsFirstOpenTutorialExiting(false);
    }, IMAGE_TEXT_TRANSLATE_TUTORIAL_EXIT_MS);
  }

  function closeConfirmation() {
    if (confirmationClosing) return;
    setConfirmationClosing(true);
    confirmationCloseTimerRef.current = window.setTimeout(() => {
      confirmationCloseTimerRef.current = null;
      setPendingDeleteTranslation(null);
      setConfirmationClosing(false);
    }, IMAGE_TEXT_TRANSLATE_TUTORIAL_EXIT_MS);
  }

  async function refreshSavedTranslations() {
    setTranslationsLoading(true);
    try {
      const result = await listImageTextTranslationsAction();
      if (result.success) {
        setSavedTranslations(result.data.translations);
        setSavedTranslationCount(result.data.totalCount);
      } else if (result.error !== "unauthorized") {
        showMessage(getTranslationErrorMessage(result.error, t), "error");
      }
    } catch {
      showMessage(getTranslationErrorMessage("database_error", t), "error");
    } finally {
      setTranslationsLoading(false);
    }
  }

  async function refreshTranslationCount() {
    try {
      const result = await getImageTextTranslationCountAction();
      if (result.success) {
        setSavedTranslationCount(result.data.totalCount);
      }
    } catch {
      // The full list response remains the fallback for the count.
    }
  }

  async function refreshTranslationUsage() {
    try {
      const result = await getImageTextTranslationUsageAction();
      if (result.success) {
        setTranslationUsage(result.data);
      }
    } catch {
      // The API remains authoritative if the client-side usage snapshot fails.
    }
  }

  async function handleOpenTranslations() {
    setShowTranslationsList(true);
    void refreshTranslationCount();
    await refreshSavedTranslations();
  }

  function handleOpenTranslationDetail(translation: SavedImageTextTranslation, origin: "generated" | "saved") {
    setDetailTranslation(translation);
    setDetailOrigin(origin);
    setWordDetail(null);
    setWordStatus("idle");
    setShowTranslationDetail(true);
  }

  function handleCloseTranslationDetail() {
    setShowTranslationDetail(false);
    setWordDetail(null);
    setWordStatus("idle");
    if (detailOrigin === "saved") {
      setShowTranslationsList(true);
    } else {
      setShowTranslationsList(false);
    }
  }

  async function handleDeleteTranslation() {
    if (!pendingDeleteTranslation || deleteLoading) return;

    setDeleteLoading(true);
    const result = await deleteImageTextTranslationAction(pendingDeleteTranslation.id);
    if (result.success) {
      setSavedTranslations((current) => current.filter((item) => item.id !== pendingDeleteTranslation.id));
      setSavedTranslationCount((current) => current === null ? null : Math.max(0, current - 1));
      closeConfirmation();
    } else {
      showMessage(getTranslationErrorMessage(result.error, t, true), "error");
    }
    setDeleteLoading(false);
  }

  async function handleFileSelection(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || pendingImageCount > 0) return;

    const availableSlots = MAX_UPLOAD_IMAGES - images.length;
    if (availableSlots <= 0) {
      showMessage(getErrorMessage("image_limit", t), "error");
      return;
    }

    const files = Array.from(fileList).slice(0, availableSlots);
    setPendingImageCount(files.length);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") || file.size > MAX_FILE_SIZE_BYTES) {
          showMessage(getErrorMessage("invalid_image", t), "error");
          continue;
        }

        try {
          const dataUrl = await imageFileToDataUrl(file);
          setImages((current) => [
            ...current,
            { id: createClientId(), name: file.name, dataUrl },
          ].slice(0, MAX_UPLOAD_IMAGES));
        } catch {
          showMessage(getErrorMessage("invalid_image", t), "error");
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

    if (translationUsage && !translationUsage.canUse) {
      onSubscriptionLimitReached?.("image_text_translate_limit");
      return;
    }

    if (mode === "image" && images.length === 0) {
      showMessage(getErrorMessage("no_images", t), "error");
      return;
    }

    if (mode === "text" && !text.trim()) {
      showMessage(getErrorMessage("no_text", t), "error");
      return;
    }

    setLoading(true);
    setDetailTranslation(null);
    setShowTranslationDetail(false);
    setWordDetail(null);
    setWordStatus("idle");

    try {
      const requestImages = mode === "image" ? images.map((image) => image.dataUrl) : undefined;
      const response = await fetch("/api/cards/image-text-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          locale,
          targetLanguage: sourceLanguage,
          answerQuestions,
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
      void refreshTranslationUsage();
      const localTranslation: SavedImageTextTranslation = {
        id: createClientId(),
        sourceLanguage,
        nativeLocale: locale,
        sentences: result.sentences,
        createdAt: new Date().toISOString(),
      };
      let savedTranslation = localTranslation;
      try {
        const saveResult = await saveImageTextTranslationAction({
          sourceLanguage,
          nativeLocale: locale,
          sentences: result.sentences,
        });
        if (saveResult.success) {
          savedTranslation = saveResult.data;
          setSavedTranslations((current) => [saveResult.data, ...current.filter((item) => item.id !== saveResult.data.id)]);
          setSavedTranslationCount((current) => current === null ? null : current + 1);
        }
      } catch {
        // A database outage must not hide a successfully generated translation.
      }
      handleOpenTranslationDetail(savedTranslation, savedTranslation === localTranslation ? "generated" : "saved");
      if (mode === "image") {
        setImages([]);
      }
    } catch (error) {
      if (getErrorCode(error) === "image_text_translate_limit") {
        setTranslationUsage((current) => current ? { ...current, canUse: false, remaining: 0 } : current);
        onSubscriptionLimitReached?.("image_text_translate_limit");
        return;
      }
      showMessage(getErrorMessage(getErrorCode(error), t), "error");
    } finally {
      setLoading(false);
    }
  }

  async function requestSingleWordTranslation(
    translation: SavedImageTextTranslation,
    selection: { word: string; clickedLanguage: ClickedLanguage; sentenceIndex: number; wordIndex: number },
  ) {
    const sentence = translation.sentences[selection.sentenceIndex];
    if (!sentence) return;

    const catalogMatch = findCatalogWordTranslation({
      word: selection.word,
      clickedLanguage: selection.clickedLanguage,
      sourceLanguage: translation.sourceLanguage,
      nativeLocale: translation.nativeLocale,
    });

    const requestId = wordRequestIdRef.current + 1;
    wordRequestIdRef.current = requestId;
    setWordStatus(catalogMatch ? "idle" : "loading");
    setWordDetail({
      clickedWord: selection.word,
      clickedLanguage: selection.clickedLanguage,
      sourceWord: catalogMatch?.sourceWord ?? (selection.clickedLanguage === "source" ? selection.word : ""),
      translation: catalogMatch?.translation ?? "",
      sentenceSource: sentence.source,
      sentenceTranslation: sentence.translation,
      sentenceIndex: selection.sentenceIndex,
      wordIndex: selection.wordIndex,
      existingCard: catalogMatch?.card,
    });

    if (catalogMatch) {
      return;
    }

    try {
      const generated = await generateCardRequest({
        locale: translation.nativeLocale,
        term: selection.word.trim(),
        targetLanguage: translation.sourceLanguage,
        direction: selection.clickedLanguage === "source" ? "learning-to-native" : "native-to-learning",
      });
      if (wordRequestIdRef.current !== requestId) return;

      setWordDetail({
        sourceWord: generated.term,
        translation: getGeneratedCardTranslation(generated, translation.nativeLocale) || selection.word,
        clickedWord: selection.word,
        clickedLanguage: selection.clickedLanguage,
        sentenceSource: sentence.source,
        sentenceTranslation: sentence.translation,
        sentenceIndex: selection.sentenceIndex,
        wordIndex: selection.wordIndex,
        generatedCard: generated,
      });
      setWordStatus("idle");
    } catch (error) {
      if (wordRequestIdRef.current !== requestId) return;
      const errorCode = getErrorCode(error);
      setWordStatus("error");
      showMessage(getWordErrorMessage(errorCode, t), "error");
    }
  }

  function handleWordClick(word: string, clickedLanguage: ClickedLanguage, sentenceIndex: number, wordIndex: number) {
    if (!word.trim() || loading || wordStatus === "adding") return;

    const translation = detailTranslation;
    const sentence = translation?.sentences[sentenceIndex];
    if (!translation || !sentence) return;

    void requestSingleWordTranslation(translation, { word, clickedLanguage, sentenceIndex, wordIndex });
  }

  async function addWordToDeck() {
    if (!wordDetail || wordStatus === "adding" || wordStatus === "added" || !wordDetail.sourceWord.trim()) return;

    setWordStatus("adding");
    const activeSourceLanguage = detailTranslation?.sourceLanguage ?? sourceLanguage;
    const activeNativeLocale = detailTranslation?.nativeLocale ?? locale;

    try {
      const existingCard = wordDetail.existingCard;

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
      } else if (wordDetail.generatedCard) {
        await createCustomCardFromGenerated(wordDetail.generatedCard, createCustomCard);
      } else {
        throw new Error("unknown");
      }

      setWordStatus("added");
      showMessage(
        t("createCard.success.addedWithLanguage", {
          language: getLanguageDisplayName(activeSourceLanguage, activeNativeLocale),
        }),
        "success",
      );
    } catch (error) {
      const limitError = getLimitErrorCode(error);
      if (limitError) {
        onSubscriptionLimitReached?.(limitError);
      }
      setWordStatus("error");
      showMessage(getAddErrorMessage(error, t), "error");
    }
  }

  const hasInput = mode === "image" ? images.length > 0 : text.trim().length > 0;
  const activeDetailSourceLanguage = detailTranslation?.sourceLanguage ?? sourceLanguage;
  const activeDetailNativeLocale = detailTranslation?.nativeLocale ?? locale;
  const sourceLanguageName = getLanguageDisplayName(activeDetailSourceLanguage, activeDetailNativeLocale);
  const nativeLanguageName = getLanguageDisplayName(activeDetailNativeLocale, activeDetailNativeLocale);
  const uploadedImageCount = images.length + pendingImageCount;
  const uploadedImageColumns = Math.min(Math.max(uploadedImageCount, 1), MAX_UPLOAD_IMAGES);
  const translationLocked = translationUsage !== null && !translationUsage.canUse;

  return (
    <>
      <MobileBottomSheetShell
        open={open}
        onClose={onClose}
        title={t("imageTranslate.title")}
        panelLabel={t("imageTranslate.title")}
        visual={null}
        fullScreen
        showPanelDecoration={false}
        showBackdrop={false}
        panelClassName="image-text-translate-surface bg-background text-foreground"
        contentClassName="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5"
      >
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-4">
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
            value={sourceLanguage}
            onChange={setSourceLanguage}
            className="image-text-translate-plain-outline !text-white"
          />
        </div>

        {mode === "image" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-foreground">{t("imageTranslate.addImage")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={pendingImageCount > 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-0 bg-action-learn px-3 text-sm font-semibold text-white transition-colors hover:bg-action-learn-hover active:scale-[0.98]"
                >
                  <Camera className="size-5" aria-hidden="true" />
                  {t("imageTranslate.camera")}
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={pendingImageCount > 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-0 bg-action-learned px-3 text-sm font-semibold text-white transition-colors hover:bg-action-review-hover active:scale-[0.98]"
                >
                  <Upload className="size-5" aria-hidden="true" />
                  {t("imageTranslate.gallery")}
                </button>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void handleFileSelection(event.target.files); event.currentTarget.value = ""; }} />
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void handleFileSelection(event.target.files); event.currentTarget.value = ""; }} />
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-foreground">
                {t("imageTranslate.uploadedImages", { count: images.length, max: MAX_UPLOAD_IMAGES })}
              </p>
              {images.length > 0 || pendingImageCount > 0 ? (
                <div
                  className="grid h-20 items-center gap-1 overflow-hidden"
                  style={{ gridTemplateColumns: `repeat(${uploadedImageColumns}, minmax(0, 1fr))` }}
                  aria-label={t("imageTranslate.uploadedImages", { count: images.length, max: MAX_UPLOAD_IMAGES })}
                >
                  {Array.from({ length: pendingImageCount }, (_, index) => (
                    <div key={`pending-image-${index}`} role="status" aria-label={t("imageTranslate.loadingImage")} className="relative aspect-square w-full max-h-[4.5rem] max-w-[4.5rem] justify-self-start overflow-hidden rounded-lg border-2 border-dashed border-white bg-background-muted">
                      <span className="absolute inset-0 flex items-center justify-center text-foreground-secondary"><Loader2 className="size-7 animate-spin" aria-hidden="true" /></span>
                    </div>
                  ))}
                  {images.map((image) => (
                    <button key={image.id} type="button" onClick={() => removeImage(image.id)} aria-label={`${t("imageTranslate.removeImage")}: ${image.name}`} className="group relative aspect-square w-full max-h-[4.5rem] max-w-[4.5rem] justify-self-start overflow-hidden rounded-lg border-2 border-white bg-background-muted shadow-sm transition-transform active:scale-95">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.dataUrl} alt={image.name} className="size-full object-contain" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-white bg-background-card/60 px-4 text-center text-sm text-foreground-secondary">{t("imageTranslate.noImages")}</div>
              )}
            </div>
          </>
        ) : (
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder={t("imageTranslate.textPlaceholder")} className="control-gradient-outline image-text-translate-plain-outline min-h-40 w-full resize-none rounded-2xl bg-background-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground-muted" />
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background-card px-4 py-3">
          <span id="image-translate-answer-questions-label" className="text-sm font-semibold text-foreground">
            {t("imageTranslate.answerQuestions")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={answerQuestions}
            aria-labelledby="image-translate-answer-questions-label"
            data-image-text-answer-questions={answerQuestions ? "on" : "off"}
            onClick={() => setAnswerQuestions((current) => !current)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-white p-0.5 transition-colors duration-200",
              answerQuestions ? "bg-[var(--brand)]" : "bg-background-muted",
            )}
          >
            <span className={cn("size-5 rounded-full bg-white transition-transform duration-200", answerQuestions && "translate-x-5")} aria-hidden="true" />
          </button>
        </div>

        <div className="mobile-primary-action-depth mobile-primary-action-depth--brand w-full rounded-xl">
          <button type="button" disabled={!hasInput || loading} onClick={handleGenerate} aria-busy={loading} aria-disabled={translationLocked} className="image-text-translate-primary-action flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-[var(--brand)] px-4 text-base font-bold text-white transition-colors active:scale-[0.98] hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed">
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : translationLocked ? null : <ScanText className="size-5" aria-hidden="true" />}
            {loading ? t("imageTranslate.generating") : translationLocked ? t("imageTranslate.upgradeToPro") : t("imageTranslate.generate")}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleOpenTranslations()}
          aria-label={savedTranslationCount === null
            ? t("imageTranslate.loadingTranslations")
            : t("imageTranslate.translationCount", { count: savedTranslationCount })}
          className="inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left text-black transition-colors hover:bg-white/90 active:scale-[0.99]"
          data-image-text-translations-trigger
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate text-base font-bold text-black", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t("imageTranslate.myTranslations"))}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-black/10 px-3 py-1 text-sm font-bold text-black" data-image-text-translations-count>
            {savedTranslationCount === null ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : savedTranslationCount}
          </span>
        </button>
      </div>
      </MobileBottomSheetShell>
      <MobileBottomSheetShell
        open={showTranslationsList}
        onClose={() => setShowTranslationsList(false)}
        title={t("imageTranslate.myTranslations")}
        panelLabel={t("imageTranslate.myTranslations")}
        visual={null}
        fullScreen
        showPanelDecoration={false}
        panelClassName="image-text-translate-surface bg-background text-foreground"
        contentClassName="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5"
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4" data-image-text-translations-list>
          {translationsLoading ? (
            <div className="flex flex-col gap-3" role="status" aria-busy="true">
              {Array.from({ length: Math.max(savedTranslationCount ?? 1, 1) }, (_, index) => (
                <button
                  key={`translation-loading-${index}`}
                  type="button"
                  disabled
                  aria-label={t("imageTranslate.loadingTranslations")}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-background-card px-4 py-3 text-left text-sm font-semibold text-foreground-secondary disabled:cursor-wait"
                >
                  <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" />
                  <span>{t("imageTranslate.loadingTranslations")}</span>
                </button>
              ))}
            </div>
          ) : savedTranslations.length === 0 ? (
            <p className="py-12 text-center text-sm text-foreground-secondary">{t("imageTranslate.noTranslations")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {savedTranslations.map((translation) => (
                <div key={translation.id} className="flex items-center gap-3 py-4 first:pt-1 last:pb-1">
                  <button
                    type="button"
                    onClick={() => handleOpenTranslationDetail(translation, "saved")}
                    className="min-w-0 flex-1 text-left transition-colors hover:text-brand"
                    data-image-text-translation-id={translation.id}
                  >
                    <span className="line-clamp-2 text-base font-semibold leading-6 text-foreground">
                      {getTranslationPreview(translation.sentences[0]?.translation ?? "")}
                    </span>
                    <span className="mt-1 block text-xs text-foreground-muted">{formatTranslationDate(translation.createdAt, locale)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPendingDeleteTranslation(translation); }}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-tier-c1 transition-colors hover:bg-tier-c1/10"
                    aria-label={`${t("imageTranslate.deleteTranslation")}: ${getTranslationPreview(translation.sentences[0]?.translation ?? "", 50)}`}
                    data-image-text-translation-delete={translation.id}
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </MobileBottomSheetShell>
      <MobileBottomSheetShell
        open={showTranslationDetail && detailTranslation !== null}
        onClose={handleCloseTranslationDetail}
        title={t("imageTranslate.translationDetails")}
        panelLabel={t("imageTranslate.translationDetails")}
        visual={null}
        fullScreen
        showPanelDecoration={false}
        panelClassName="image-text-translate-surface bg-background text-foreground"
        contentClassName="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5"
      >
        {detailTranslation ? (
          <TranslationDetailContent
            translation={detailTranslation}
            sourceLanguageName={sourceLanguageName}
            nativeLanguageName={nativeLanguageName}
            sourceTitle={t("imageTranslate.sourceText")}
            translationTitle={t("imageTranslate.translatedText")}
            separatorLabels={{
              text: t("imageTranslate.newText"),
              paragraph: t("imageTranslate.paragraph"),
              question: t("imageTranslate.question"),
            }}
            activeSourceWord={wordDetail?.clickedLanguage === "source" ? wordDetail.clickedWord : null}
            activeNativeWord={wordDetail?.clickedLanguage === "native" ? wordDetail.clickedWord : null}
            onWordClick={handleWordClick}
          />
        ) : null}
      </MobileBottomSheetShell>
      {open && showTranslationDetail && detailTranslation && wordDetail && typeof document !== "undefined"
        ? createPortal(
            <WordDetailOverlay
              translation={detailTranslation}
              sourceLanguageName={sourceLanguageName}
              wordDetail={wordDetail}
              wordStatus={wordStatus}
              onClose={() => { setWordDetail(null); setWordStatus("idle"); }}
              onAdd={() => void addWordToDeck()}
              t={t}
            />,
            document.body,
          )
        : null}
      {pendingDeleteTranslation && typeof document !== "undefined"
        ? createPortal(
            <div className={cn("card-group-confirm-overlay fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 px-5", confirmationClosing && "card-group-confirm-overlay--closing")}>
              <div className="w-full max-w-sm rounded-2xl bg-[#131313] p-5 text-center text-white" role="dialog" aria-modal="true" aria-label={t("imageTranslate.deleteTranslationConfirm")}>
                <Trash2 className="card-group-confirm-overlay__item mx-auto size-10 text-tier-c1" style={{ animationDelay: "420ms" }} aria-hidden="true" />
                <p className={cn("card-group-confirm-overlay__item mt-3 text-lg font-bold", canUseSuperWater(locale) && "font-super-water")} style={{ animationDelay: "520ms" }}>{formatSuperWaterText(locale, t("imageTranslate.deleteTranslationConfirm"))}</p>
                <p className="card-group-confirm-overlay__item mt-2 line-clamp-2 text-sm text-white/70" style={{ animationDelay: "560ms" }}>{getTranslationPreview(pendingDeleteTranslation.sentences[0]?.translation ?? "")}</p>
                <div className="card-group-confirm-overlay__item mt-5 grid grid-cols-2 gap-3" style={{ animationDelay: "590ms" }}>
                  <button type="button" onClick={closeConfirmation} disabled={deleteLoading || confirmationClosing} className="h-11 rounded-full bg-tier-c1 px-4 text-sm font-bold text-white disabled:opacity-60">{t("imageTranslate.cancel")}</button>
                  <button type="button" onClick={() => void handleDeleteTranslation()} disabled={deleteLoading || confirmationClosing} className="h-11 rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground disabled:opacity-60">{deleteLoading ? <Loader2 className="mx-auto size-5 animate-spin" aria-hidden="true" /> : t("imageTranslate.delete")}</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {open && showFirstOpenTutorial && typeof document !== "undefined"
        ? createPortal(
            <ImageTextTranslateFirstOpenTutorial
              exiting={isFirstOpenTutorialExiting}
              message={t("imageTranslate.description")}
              nextLabel={t("tutorial.understood")}
              onNext={handleFirstOpenTutorialContinue}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function ImageTextTranslateFirstOpenTutorial({ exiting, message, nextLabel, onNext }: { exiting: boolean; message: string; nextLabel: string; onNext: () => void }) {
  return (
    <div
      data-testid="image-text-translate-first-open-tutorial"
      data-image-text-translate-tutorial
      role="dialog"
      aria-modal="true"
      aria-label={message}
      className={cn("tutorial-origin-overlay fixed inset-0 z-[1000] flex min-h-[100dvh] items-center justify-center bg-black/80 px-5 text-center backdrop-blur-[2px]", exiting && "tutorial-origin-overlay--closing")}
      style={{ transformOrigin: "50% 50%" }}
    >
      <div className="tutorial-origin-overlay__item flex w-full max-w-[20rem] flex-col items-center" style={{ animationDelay: exiting ? "0ms" : "520ms" }}>
        <div className="relative w-full pl-20">
          <Image aria-hidden="true" alt="" className="pointer-events-none absolute -left-5 top-8 z-10 h-auto w-24" height={512} priority src="/mascots/mascot5.webp" width={512} />
          <p className="relative z-20 flex min-h-28 items-center rounded-lg bg-white px-4 py-4 text-center text-base font-semibold leading-snug text-brand shadow-sm before:absolute before:-left-3.5 before:bottom-5 before:h-8 before:w-4 before:bg-white before:[clip-path:polygon(100%_0,100%_100%,0_50%)]">{message}</p>
        </div>
        <button type="button" data-image-text-translate-tutorial-next onClick={onNext} disabled={exiting} className="mt-12 h-14 w-[calc(100%-4rem)] rounded-lg bg-brand text-base font-bold text-brand-foreground shadow-sm transition-[background-color,transform] duration-300 hover:bg-brand-hover active:scale-[0.98] disabled:pointer-events-none focus:outline-none focus-visible:outline-none">{nextLabel}</button>
      </div>
    </div>
  );
}

function TranslationDetailContent({
  translation,
  sourceLanguageName,
  nativeLanguageName,
  sourceTitle,
  translationTitle,
  separatorLabels,
  activeSourceWord,
  activeNativeWord,
  onWordClick,
}: {
  translation: SavedImageTextTranslation;
  sourceLanguageName: string;
  nativeLanguageName: string;
  sourceTitle: string;
  translationTitle: string;
  separatorLabels: Record<ImageTextSeparator, string>;
  activeSourceWord: string | null;
  activeNativeWord: string | null;
  onWordClick: (word: string, clickedLanguage: ClickedLanguage, sentenceIndex: number, wordIndex: number) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-image-text-translation-detail>
      <div className="overflow-hidden rounded-2xl border border-border bg-background-card/80 shadow-sm">
        {translation.sentences.map((sentence, index) => {
          const separator = sentence.separators[sentence.separators.length - 1];

          return (
            <div key={`saved-sentence-pair-${translation.id}-${index}`}>
              {separator ? <TextSeparatorDivider label={separatorLabels[separator]} /> : null}
              <SentencePairPanel
                index={index}
                sentence={sentence}
                sourceLanguage={translation.sourceLanguage}
                sourceLanguageName={sourceLanguageName}
                nativeLanguageName={nativeLanguageName}
                nativeLanguage={translation.nativeLocale}
                sourceTitle={sourceTitle}
                translationTitle={translationTitle}
                hasSeparator={sentence.separators.length > 0}
                activeSourceWord={activeSourceWord}
                activeNativeWord={activeNativeWord}
                onWordClick={onWordClick}
              />
            </div>
          );
        })}
      </div>

    </div>
  );
}

function TextSeparatorDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase text-foreground-secondary" aria-label={label}>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

function WordDetailOverlay({
  translation,
  sourceLanguageName,
  wordDetail,
  wordStatus,
  onClose,
  onAdd,
  t,
}: {
  translation: SavedImageTextTranslation;
  sourceLanguageName: string;
  wordDetail: WordDetail;
  wordStatus: WordStatus;
  onClose: () => void;
  onAdd: () => void;
  t: ReturnType<typeof useT>;
}) {
  const tier = wordDetail.existingCard?.tier ?? wordDetail.generatedCard?.tier;
  const tierColor = tier ? TIER_COLOR_VARIABLES[tier] : "var(--background-card)";
  const darkTierColor = tier ? `color-mix(in oklab, ${tierColor} 72%, #000)` : tierColor;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 px-5 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("imageTranslate.wordDetails")}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/30 p-4 text-white shadow-lg transition-[background-color] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]"
        style={{ backgroundColor: darkTierColor }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-white/75">{t("imageTranslate.wordDetails")}</p>
            <div className="mt-2 flex items-center gap-2">
              <LanguageFlag code={translation.sourceLanguage} className="h-5 w-7 shrink-0" />
              <span className="truncate text-lg font-bold">{wordDetail.sourceWord || wordDetail.clickedWord}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("imageTranslate.closeWordDetails")} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-black/15 hover:text-white">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="rounded-2xl bg-black/15 px-3 py-3">
          {wordStatus === "loading" ? (
            <div className="flex items-center gap-2 py-1 text-sm text-white/80"><Loader2 className="size-5 animate-spin" aria-hidden="true" />{t("imageTranslate.translatingWord")}</div>
          ) : (
            <p className="text-base font-semibold">{wordDetail.translation}</p>
          )}
        </div>
        <div className="mt-3 rounded-2xl border border-white/25 bg-black/10 px-3 py-3">
          <p className="text-xs font-semibold text-white/75">{t("imageTranslate.context")}</p>
          <p className="mt-2 text-sm leading-5">{wordDetail.sentenceSource}</p>
          <p className="mt-1 text-sm leading-5 text-white/75">{wordDetail.sentenceTranslation}</p>
        </div>
        <p className="mt-3 text-xs text-white/75">{t("imageTranslate.cardLanguage", { language: sourceLanguageName })}</p>
        <button type="button" disabled={wordStatus === "loading" || wordStatus === "adding" || wordStatus === "added" || wordStatus === "error" || !wordDetail.sourceWord || !wordDetail.translation} onClick={onAdd} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60">
          {wordStatus === "adding" ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : wordStatus === "added" ? <Check className="size-5" aria-hidden="true" /> : <BookOpen className="size-5" aria-hidden="true" />}
          {wordStatus === "adding" ? t("imageTranslate.adding") : wordStatus === "added" ? t("imageTranslate.added") : t("imageTranslate.add")}
        </button>
      </div>
    </div>
  );
}

const TIER_COLOR_VARIABLES: Record<Tier, string> = {
  A1: "var(--tier-a1)",
  A2: "var(--tier-a2)",
  B1: "var(--tier-b1)",
  B2: "var(--tier-b2)",
  C1: "var(--tier-c1)",
};

function SentencePairPanel({
  index,
  sentence,
  sourceLanguage,
  sourceLanguageName,
  nativeLanguageName,
  nativeLanguage,
  sourceTitle,
  translationTitle,
  hasSeparator,
  activeSourceWord,
  activeNativeWord,
  onWordClick,
}: {
  index: number;
  sentence: ImageTextSentencePair;
  sourceLanguage: LanguageCode;
  sourceLanguageName: string;
  nativeLanguageName: string;
  nativeLanguage: LanguageCode;
  sourceTitle: string;
  translationTitle: string;
  hasSeparator: boolean;
  activeSourceWord: string | null;
  activeNativeWord: string | null;
  onWordClick: (word: string, clickedLanguage: ClickedLanguage, sentenceIndex: number, wordIndex: number) => void;
}) {
  return (
    <article className={cn("p-4", index > 0 && !hasSeparator && "border-t border-border")}>
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LanguageFlag code={sourceLanguage} className="h-5 w-7 shrink-0" />
            <h4 className="text-xs font-semibold text-foreground-secondary">{sourceTitle}</h4>
            <span className="truncate text-xs text-foreground-muted">{sourceLanguageName}</span>
          </div>
          <TokenizedText
            text={sentence.source}
            language={sourceLanguage}
            sentenceIndex={index}
            clickedLanguage="source"
            activeWord={activeSourceWord}
            onWordClick={onWordClick}
          />
        </div>
        <div className="h-px bg-border" aria-hidden="true" />
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LanguageFlag code={nativeLanguage} className="h-5 w-7 shrink-0" />
            <h4 className="text-xs font-semibold text-foreground-secondary">{translationTitle}</h4>
            <span className="truncate text-xs text-foreground-muted">{nativeLanguageName}</span>
          </div>
          <TokenizedText
            text={sentence.translation}
            language={nativeLanguage}
            sentenceIndex={index}
            clickedLanguage="native"
            activeWord={activeNativeWord}
            onWordClick={onWordClick}
          />
        </div>
      </div>
    </article>
  );
}

function TokenizedText({
  text,
  language,
  sentenceIndex,
  clickedLanguage,
  activeWord,
  onWordClick,
}: {
  text: string;
  language: LanguageCode;
  sentenceIndex: number;
  clickedLanguage: ClickedLanguage;
  activeWord: string | null;
  onWordClick: (word: string, clickedLanguage: ClickedLanguage, sentenceIndex: number, wordIndex: number) => void;
}) {
  let wordIndex = 0;

  return (
    <p className="whitespace-pre-wrap break-words text-base leading-8 text-foreground">
      {segmentText(text, language).map((segment, index) => {
        if (!segment.isWordLike) {
          return <span key={`${segment.text}-${index}`}>{segment.text}</span>;
        }

        const currentWordIndex = wordIndex;
        wordIndex += 1;
        return (
          <button
            key={`${segment.text}-${index}`}
            type="button"
            onClick={() => onWordClick(segment.text, clickedLanguage, sentenceIndex, currentWordIndex)}
            aria-label={segment.text}
            className={cn("rounded-md px-0.5 underline decoration-dotted underline-offset-4 transition-colors hover:bg-brand/15", activeWord === segment.text && "bg-brand/20 text-brand")}
          >
            {segment.text}
          </button>
        );
      })}
    </p>
  );
}

function findCatalogWordTranslation({
  word,
  clickedLanguage,
  sourceLanguage,
  nativeLocale,
}: {
  word: string;
  clickedLanguage: ClickedLanguage;
  sourceLanguage: LanguageCode;
  nativeLocale: LanguageCode;
}): { sourceWord: string; translation: string; card: VocabularyCard } | null {
  const normalizedWord = normalizeSearch(word);
  if (!normalizedWord) return null;

  const card = localCardRepository.list({ language: sourceLanguage }).find((candidate) => {
    if (clickedLanguage === "source") {
      return normalizeSearch(candidate.term) === normalizedWord;
    }

    return getCardTranslationMeanings(candidate, nativeLocale).some((meaning) => normalizeSearch(meaning) === normalizedWord);
  });

  if (!card) return null;

  return {
    sourceWord: card.term,
    translation: clickedLanguage === "source" ? getPrimaryCardTranslation(card, nativeLocale) : word,
    card,
  };
}

function getGeneratedCardTranslation(generated: GeneratedCardResponse, locale: LanguageCode) {
  return generated.translations[locale] ?? generated.translations.en ?? "";
}

function segmentText(text: string, language: LanguageCode): Array<{ text: string; isWordLike: boolean }> {
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (locale: string, options: { granularity: "word" }) => {
      segment: (value: string) => Iterable<{ segment: string; isWordLike?: boolean }>;
    };
  }).Segmenter;

  if (Segmenter) {
    return Array.from(new Segmenter(language, { granularity: "word" }).segment(text)).map((part) => ({
      text: part.segment,
      isWordLike: part.isWordLike ?? false,
    }));
  }

  return text.match(/\s+|[\p{L}\p{N}]+(?:[\u2019'-][\p{L}\p{N}]+)*|[^\p{L}\p{N}\s]+/gu)?.map((part) => ({
    text: part,
    isWordLike: /[\p{L}\p{N}]/u.test(part),
  })) ?? [];
}

function createClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
        const maxDimension = 1600;
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

        let quality = 0.82;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > MAX_COMPRESSED_IMAGE_DATA_URL_LENGTH && quality > 0.58) {
          quality = Math.max(0.58, quality - 0.06);
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        // A very detailed image can still exceed the request budget after
        // quality reduction. Scale it down only in that uncommon case; text
        // remains readable while six images stay within the server limit.
        if (dataUrl.length > MAX_COMPRESSED_IMAGE_DATA_URL_LENGTH) {
          const fallbackScale = Math.sqrt(MAX_COMPRESSED_IMAGE_DATA_URL_LENGTH / dataUrl.length);
          const fallbackWidth = Math.max(1, Math.floor(canvas.width * fallbackScale));
          const fallbackHeight = Math.max(1, Math.floor(canvas.height * fallbackScale));
          canvas.width = fallbackWidth;
          canvas.height = fallbackHeight;
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, fallbackWidth, fallbackHeight);
          context.drawImage(image, 0, 0, fallbackWidth, fallbackHeight);
          dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        }

        if (dataUrl.length > MAX_COMPRESSED_IMAGE_DATA_URL_LENGTH) {
          reject(new Error("invalid_image"));
          return;
        }

        resolve(dataUrl);
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
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
  return t("createCard.error.addFailed");
}

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

function getTranslationErrorMessage(errorCode: string, t: ReturnType<typeof useT>, deleting = false) {
  if (errorCode === "unauthorized") return t("imageTranslate.error.auth_required");
  return deleting ? t("imageTranslate.deleteFailed") : t("imageTranslate.loadFailed");
}

function formatTranslationDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "";
  }
}

function getWordErrorMessage(errorCode: string, t: ReturnType<typeof useT>) {
  if (errorCode === "ai_daily_limit" || errorCode === "ai_monthly_limit") return formatErrorMessage(errorCode, t);
  if (errorCode === "auth_required" || errorCode === "not_configured" || errorCode === "upstream_error" || errorCode === "usage_unavailable") return formatErrorMessage(errorCode, t);
  return t("imageTranslate.error.wordTranslationFailed");
}
