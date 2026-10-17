"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Link2, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import type { SocialAnalyticsAccount } from "@/features/developer/social-analytics-types";
import { getSocialPlatformTheme, SocialPlatformBrandIcon } from "@/features/developer/components/social-platform-brand";
import { stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";

type ImageAsset = {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type VideoAsset = {
  sourceUrl: string;
  mimeType: "video/mp4" | "video/webm";
};

type ComposerState = "idle" | "sending" | "sent" | "error";

type ComposerSettings = {
  instagramMediaType: "REELS" | "STORIES";
  instagramShareToFeed: boolean;
  tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  youtubePrivacyStatus: "public" | "unlisted" | "private";
  youtubeCategoryId: string;
  facebookPageId: string;
  facebookMediaType: "REELS" | "STORIES" | "VIDEO";
  linkedinVisibility: "PUBLIC" | "CONNECTIONS" | "LOGGED_IN" | "CONTAINER";
  threadsTopicTag: string;
  threadsReplyControl: "everyone" | "accounts_you_follow" | "mentioned_only";
  threadsAltText: string;
  xReplySettings: "everyone" | "mentionedUsers" | "following";
  pinterestBoardId: string;
  pinterestLink: string;
  pinterestAltText: string;
  blueskyAltText: string;
  blueskyThreadgate: "following" | "mention" | "list" | "mutuals";
  gbpLocationId: string;
  gbpTopicType: "STANDARD" | "EVENT" | "OFFER";
  gbpCtaType: "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";
  gbpCtaUrl: string;
};

const INITIAL_SETTINGS: ComposerSettings = {
  instagramMediaType: "REELS",
  instagramShareToFeed: true,
  tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE",
  youtubePrivacyStatus: "public",
  youtubeCategoryId: "22",
  facebookPageId: "",
  facebookMediaType: "VIDEO",
  linkedinVisibility: "PUBLIC",
  threadsTopicTag: "",
  threadsReplyControl: "everyone",
  threadsAltText: "",
  xReplySettings: "everyone",
  pinterestBoardId: "",
  pinterestLink: "",
  pinterestAltText: "",
  blueskyAltText: "",
  blueskyThreadgate: "following",
  gbpLocationId: "",
  gbpTopicType: "STANDARD",
  gbpCtaType: "CALL",
  gbpCtaUrl: "",
};

type Props = {
  account: SocialAnalyticsAccount;
  onClose: () => void;
  onPublished?: () => void;
};

const PLATFORM_COPY: Record<string, {
  placeholder: string;
  maxLength: number;
  titleLabel?: string;
  titlePlaceholder?: string;
  titleRequired?: boolean;
  videoOnly?: boolean;
  mediaRequired?: boolean;
  mediaLabel: string;
}> = {
  instagram: { placeholder: "Açıklama yaz…", maxLength: 2_200, mediaRequired: true, mediaLabel: "Görsel veya video ekle" },
  tiktok: { placeholder: "Bu paylaşım hakkında ne düşünüyorsun?", maxLength: 2_200, mediaRequired: true, mediaLabel: "Görsel veya video ekle" },
  youtube: { placeholder: "Videonun açıklamasını yaz…", maxLength: 5_000, titleLabel: "Video başlığı", titlePlaceholder: "Videona bir başlık ver", titleRequired: true, videoOnly: true, mediaLabel: "Video ekle" },
  facebook: { placeholder: "Ne düşünüyorsun?", maxLength: 8_000, mediaLabel: "Fotoğraf veya video ekle" },
  x: { placeholder: "Neler oluyor?", maxLength: 280, mediaLabel: "Görsel veya video ekle" },
  linkedin: { placeholder: "Aklından ne geçiyor?", maxLength: 3_000, mediaLabel: "Görsel veya video ekle" },
  threads: { placeholder: "Yeni bir düşünce paylaş…", maxLength: 500, mediaLabel: "Görsel veya video ekle" },
  pinterest: { placeholder: "Bu Pin hakkında bir şeyler yaz…", maxLength: 500, titleLabel: "Pin başlığı", titlePlaceholder: "Pin başlığı", mediaRequired: true, mediaLabel: "Görsel veya video ekle" },
  reddit: { placeholder: "Gönderinin içeriğini yaz…", maxLength: 40_000, titleLabel: "Başlık", titlePlaceholder: "Gönderine bir başlık ver", mediaLabel: "Görsel ekle" },
  bluesky: { placeholder: "Ne paylaşmak istiyorsun?", maxLength: 300, mediaLabel: "Görsel veya video ekle" },
  google_business: { placeholder: "İşletmenle ilgili bir güncelleme paylaş…", maxLength: 1_500, titleLabel: "Gönderi başlığı", titlePlaceholder: "Başlık (isteğe bağlı)", mediaLabel: "Görsel veya video ekle" },
};

function platformKey(platform: string) {
  return platform.trim().toLocaleLowerCase().replace(/[()]/gu, "").replace(/[\s./-]+/gu, "_");
}

function getCopy(platform: string) {
  return PLATFORM_COPY[platformKey(platform)] ?? { placeholder: "Bir şeyler paylaş…", maxLength: 2_000, mediaLabel: "Görsel veya video ekle" };
}

function errorMessage(errorCode: string) {
  const messages: Record<string, string> = {
    invalid_request: "Gönderi bilgileri geçersiz. Metin, medya ve platform ayarlarını kontrol et.",
    account_not_found: "Bu sosyal medya hesabı artık bulunamıyor. Analytics verisini yenile.",
    invalid_media: "Bu medya işlenemedi. Görsel PNG, JPEG veya WebP ve 5 MB altında; video MP4/WebM ve 100 MB altında olmalı.",
    video_too_large: "Video 100 MB sınırını aşıyor.",
    media_stage_unavailable: "Video yükleme alanı hazırlanamadı. Birkaç saniye sonra tekrar dene.",
    media_stage_upload_failed: "Video sunucuya yüklenemedi. Bağlantını kontrol edip tekrar dene.",
    upload_post_not_configured: "Upload-Post API anahtarı bu sunucuda yapılandırılmamış.",
    upload_post_profile_not_configured: "Bu hesap için Upload-Post profil adı eksik.",
    upload_post_pinterest_board_not_configured: "Pinterest board ID gerekli. Pin ayarlarına board ID gir.",
    upload_post_carousel_limit: "Pinterest gönderilerinde en fazla 5 görsel kullanılabilir.",
    upload_post_unsupported_content: "Bu medya türü seçilen platform tarafından desteklenmiyor.",
    upload_post_reddit_unavailable: "Upload-Post şu anda Reddit gönderilerini desteklemiyor.",
    upload_post_rejected: "Upload-Post gönderiyi reddetti. Hesap yetkilerini ve platform limitlerini kontrol et.",
  };
  return messages[errorCode] ?? "Gönderi yayınlanamadı. Birkaç saniye sonra tekrar dene.";
}

function readImage(file: File) {
  return new Promise<ImageAsset>((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      reject(new Error("invalid_media"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve({ dataUrl: reader.result, mimeType: file.type as ImageAsset["mimeType"] })
      : reject(new Error("invalid_media"));
    reader.onerror = () => reject(new Error("invalid_media"));
    reader.readAsDataURL(file);
  });
}

function fieldClass() {
  return "mt-2 h-11 w-full rounded-xl border border-[#dce4da] bg-[#fbfcfa] px-3 text-sm text-[#26342b] outline-none transition-colors placeholder:text-[#a0aaa2] focus:border-[#7b9f85] focus-visible:ring-2 focus-visible:ring-[#7b9f85]/30";
}

function SelectField({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block text-xs font-semibold text-[#536158]">
    <span>{label}</span>
    <select className={fieldClass()} name={name} onChange={(event) => onChange(event.target.value)} value={value}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

function TextField({ label, name, value, onChange, placeholder, maxLength, type = "text" }: { label: string; name: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number; type?: "text" | "url" }) {
  return <label className="block text-xs font-semibold text-[#536158]">
    <span>{label}</span>
    <input className={fieldClass()} autoComplete="off" maxLength={maxLength} name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
  </label>;
}

function SettingsFields({ platform, settings, update }: { platform: string; settings: ComposerSettings; update: (key: keyof ComposerSettings, value: string | boolean) => void }) {
  if (platform === "instagram") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <SelectField label="Paylaşım türü" name="instagramMediaType" onChange={(value) => update("instagramMediaType", value)} options={[{ value: "REELS", label: "Reels" }, { value: "STORIES", label: "Story" }]} value={settings.instagramMediaType} />
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dce4da] bg-[#fbfcfa] px-3 text-xs font-semibold text-[#536158]"><input checked={settings.instagramShareToFeed} className="size-4 accent-[#7b9f85]" name="instagramShareToFeed" onChange={(event) => update("instagramShareToFeed", event.target.checked)} type="checkbox" />Reels’i akışta da paylaş</label>
  </div>;
  if (platform === "tiktok") return <div className="mt-5"><SelectField label="Gizlilik" name="tiktokPrivacyLevel" onChange={(value) => update("tiktokPrivacyLevel", value)} options={[{ value: "PUBLIC_TO_EVERYONE", label: "Herkese açık" }, { value: "MUTUAL_FOLLOW_FRIENDS", label: "Arkadaşlar" }, { value: "SELF_ONLY", label: "Yalnızca ben" }]} value={settings.tiktokPrivacyLevel} /></div>;
  if (platform === "youtube") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <SelectField label="Görünürlük" name="youtubePrivacyStatus" onChange={(value) => update("youtubePrivacyStatus", value)} options={[{ value: "public", label: "Herkese açık" }, { value: "unlisted", label: "Liste dışı" }, { value: "private", label: "Özel" }]} value={settings.youtubePrivacyStatus} />
    <SelectField label="Kategori" name="youtubeCategoryId" onChange={(value) => update("youtubeCategoryId", value)} options={[{ value: "22", label: "Kişiler ve bloglar" }, { value: "27", label: "Eğitim" }, { value: "24", label: "Eğlence" }, { value: "28", label: "Bilim ve teknoloji" }]} value={settings.youtubeCategoryId} />
  </div>;
  if (platform === "facebook") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <TextField label="Facebook Page ID" name="facebookPageId" onChange={(value) => update("facebookPageId", value)} placeholder="Sayfa ID’si" value={settings.facebookPageId} />
    <SelectField label="Paylaşım türü" name="facebookMediaType" onChange={(value) => update("facebookMediaType", value)} options={[{ value: "VIDEO", label: "Video" }, { value: "REELS", label: "Reels" }, { value: "STORIES", label: "Story" }]} value={settings.facebookMediaType} />
  </div>;
  if (platform === "linkedin") return <div className="mt-5"><SelectField label="Görünürlük" name="linkedinVisibility" onChange={(value) => update("linkedinVisibility", value)} options={[{ value: "PUBLIC", label: "Herkese açık" }, { value: "CONNECTIONS", label: "Bağlantılar" }, { value: "LOGGED_IN", label: "LinkedIn üyeleri" }, { value: "CONTAINER", label: "Kuruluş" }]} value={settings.linkedinVisibility} /></div>;
  if (platform === "threads") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <TextField label="Konu etiketi" name="threadsTopicTag" onChange={(value) => update("threadsTopicTag", value)} placeholder="Örn. languagelearning" maxLength={100} value={settings.threadsTopicTag} />
    <SelectField label="Yanıt izni" name="threadsReplyControl" onChange={(value) => update("threadsReplyControl", value)} options={[{ value: "everyone", label: "Herkes" }, { value: "accounts_you_follow", label: "Takip ettiklerin" }, { value: "mentioned_only", label: "Bahsedilenler" }]} value={settings.threadsReplyControl} />
    <div className="sm:col-span-2"><TextField label="Alternatif metin" name="threadsAltText" onChange={(value) => update("threadsAltText", value)} placeholder="Görseli açıklayan kısa metin" maxLength={1_000} value={settings.threadsAltText} /></div>
  </div>;
  if (platform === "x") return <div className="mt-5"><SelectField label="Yanıt izni" name="xReplySettings" onChange={(value) => update("xReplySettings", value)} options={[{ value: "everyone", label: "Herkes" }, { value: "mentionedUsers", label: "Bahsedilen hesaplar" }, { value: "following", label: "Takip ettiklerin" }]} value={settings.xReplySettings} /></div>;
  if (platform === "pinterest") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <TextField label="Board ID" name="pinterestBoardId" onChange={(value) => update("pinterestBoardId", value)} placeholder="Pinterest board ID" value={settings.pinterestBoardId} />
    <TextField label="Bağlantı" name="pinterestLink" onChange={(value) => update("pinterestLink", value)} placeholder="https://… (isteğe bağlı)" type="url" value={settings.pinterestLink} />
    <div className="sm:col-span-2"><TextField label="Alternatif metin" name="pinterestAltText" onChange={(value) => update("pinterestAltText", value)} placeholder="Pin görselini açıklayan kısa metin" maxLength={500} value={settings.pinterestAltText} /></div>
  </div>;
  if (platform === "bluesky") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <TextField label="Alternatif metin" name="blueskyAltText" onChange={(value) => update("blueskyAltText", value)} placeholder="Görseli açıklayan kısa metin" maxLength={1_000} value={settings.blueskyAltText} />
    <SelectField label="Yanıt kısıtlaması" name="blueskyThreadgate" onChange={(value) => update("blueskyThreadgate", value)} options={[{ value: "following", label: "Takip ettiklerin" }, { value: "mention", label: "Bahsedilenler" }, { value: "list", label: "Liste" }, { value: "mutuals", label: "Karşılıklı takip" }]} value={settings.blueskyThreadgate} />
  </div>;
  if (platform === "google_business") return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <TextField label="Konum ID" name="gbpLocationId" onChange={(value) => update("gbpLocationId", value)} placeholder="Google Business konum ID’si" value={settings.gbpLocationId} />
    <SelectField label="Gönderi türü" name="gbpTopicType" onChange={(value) => update("gbpTopicType", value)} options={[{ value: "STANDARD", label: "Standart" }, { value: "EVENT", label: "Etkinlik" }, { value: "OFFER", label: "Teklif" }]} value={settings.gbpTopicType} />
    <SelectField label="Aksiyon butonu" name="gbpCtaType" onChange={(value) => update("gbpCtaType", value)} options={[{ value: "CALL", label: "Ara" }, { value: "LEARN_MORE", label: "Daha fazla bilgi" }, { value: "BOOK", label: "Rezervasyon yap" }, { value: "ORDER", label: "Sipariş ver" }, { value: "SHOP", label: "Alışveriş yap" }, { value: "SIGN_UP", label: "Kayıt ol" }]} value={settings.gbpCtaType} />
    {settings.gbpCtaType !== "CALL" ? <TextField label="Aksiyon bağlantısı" name="gbpCtaUrl" onChange={(value) => update("gbpCtaUrl", value)} placeholder="https://…" type="url" value={settings.gbpCtaUrl} /> : null}
  </div>;
  return null;
}

function Preview({ platform, account, caption, title, image, video }: { platform: string; account: SocialAnalyticsAccount; caption: string; title: string; image?: string; video?: string }) {
  const key = platformKey(platform);
  const theme = getSocialPlatformTheme(platform);
  const isInstagram = key === "instagram";
  const isX = key === "x";
  const isPinterest = key === "pinterest";
  return <div className="overflow-hidden rounded-2xl border border-[#e2e5df] bg-white shadow-[0_14px_40px_rgba(30,45,35,0.08)]">
    <div className="flex items-center gap-2 border-b border-[#edf0eb] px-4 py-3">
      <span className="grid size-8 place-items-center rounded-full text-white" style={{ backgroundColor: theme.accent }}><SocialPlatformBrandIcon platform={platform} className="size-4" /></span>
      <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#26342b]">{account.accountName}</p><p className="text-[11px] text-[#89938b]">Önizleme · {theme.label}</p></div>
    </div>
    {video ? <div className="overflow-hidden bg-[#eef1ec]"><video className="aspect-video size-full object-cover" controls height={338} muted playsInline preload="metadata" src={video} width={600} /></div> : image ? <div className={"overflow-hidden bg-[#eef1ec] " + (isPinterest ? "aspect-[4/5]" : "aspect-square")}><img alt="Gönderi önizlemesi" className="size-full object-cover" height={600} loading="lazy" src={image} width={600} /></div> : <div className="grid aspect-[4/3] place-items-center bg-[#f3f5f1] px-5 text-center text-xs text-[#9aa49c]"><ImagePlus className="mb-2 size-6" />Medya eklendiğinde burada görünecek</div>}
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2 text-[#26342b]"><span className="size-2 rounded-full" style={{ backgroundColor: theme.accent }} /><span className="text-xs font-semibold">{isX ? "Yeni gönderi" : isInstagram ? "Gönderi" : "Paylaşım"}</span></div>
      {title ? <p className="mb-1 text-sm font-semibold text-[#26342b]">{title}</p> : null}
      <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-[#56645a]">{caption || "Gönderi metnin burada görünecek."}</p>
    </div>
  </div>;
}

export function SocialPostComposerOverlay({ account, onClose, onPublished }: Props) {
  const key = platformKey(account.platform);
  const theme = getSocialPlatformTheme(account.platform);
  const copy = useMemo(() => getCopy(account.platform), [account.platform]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<ImageAsset>();
  const [video, setVideo] = useState<VideoAsset>();
  const [videoUrl, setVideoUrl] = useState("");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [state, setState] = useState<ComposerState>("idle");
  const [message, setMessage] = useState("");
  const [stagingVideo, setStagingVideo] = useState(false);
  const [requestId, setRequestId] = useState(() => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && state !== "sending") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])") ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, state]);

  const canUseVideoUrl = Boolean(video || videoUrl.trim());
  const hasMedia = Boolean(image || canUseVideoUrl);
  const requiresVideo = Boolean(copy.videoOnly);
  const isReddit = key === "reddit";
  const disabled = state === "sending" || stagingVideo || isReddit || (copy.titleRequired && !title.trim()) || (!copy.titleRequired && !caption.trim()) || (copy.mediaRequired && !hasMedia) || (requiresVideo && !canUseVideoUrl) || caption.length > copy.maxLength;

  function markDraftChanged() {
    if (state === "sent") setRequestId(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");
    if (state !== "sending") {
      setState("idle");
      setMessage("");
    }
  }

  function updateSetting(keyName: keyof ComposerSettings, value: string | boolean) {
    markDraftChanged();
    setSettings((current) => ({ ...current, [keyName]: value }));
  }

  async function onFileChange(file: File | undefined) {
    if (!file) return;
    markDraftChanged();
    try {
      if (file.type.startsWith("video/")) {
        if (!["video/mp4", "video/webm"].includes(file.type)) throw new Error("invalid_media");
        setStagingVideo(true);
        setMessage("Video hazırlanıyor…");
        setImage(undefined);
        const staged = await stageBrowserVideo(file, "manual-video");
        setVideo(staged);
        setVideoUrl("");
        setMessage("Video hazır.");
      } else {
        setImage(await readImage(file));
        setVideo(undefined);
        setVideoUrl("");
        setMessage("");
      }
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(errorMessage(error instanceof Error ? error.message : "invalid_media"));
    } finally {
      setStagingVideo(false);
    }
  }

  function clearMedia() {
    markDraftChanged();
    setImage(undefined);
    setVideo(undefined);
    setVideoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function buildOptions() {
    if (key === "instagram") return { instagramMediaType: settings.instagramMediaType, instagramShareToFeed: settings.instagramShareToFeed };
    if (key === "tiktok") return { tiktokPrivacyLevel: settings.tiktokPrivacyLevel };
    if (key === "youtube") return { youtubePrivacyStatus: settings.youtubePrivacyStatus, youtubeCategoryId: settings.youtubeCategoryId };
    if (key === "facebook") return { facebookPageId: settings.facebookPageId, facebookMediaType: settings.facebookMediaType };
    if (key === "linkedin") return { linkedinVisibility: settings.linkedinVisibility };
    if (key === "threads") return { threadsTopicTag: settings.threadsTopicTag, threadsReplyControl: settings.threadsReplyControl, threadsAltText: settings.threadsAltText };
    if (key === "x") return { xReplySettings: settings.xReplySettings };
    if (key === "pinterest") return { pinterestBoardId: settings.pinterestBoardId, pinterestLink: settings.pinterestLink, pinterestAltText: settings.pinterestAltText };
    if (key === "bluesky") return { blueskyAltText: settings.blueskyAltText, blueskyThreadgate: settings.blueskyThreadgate };
    if (key === "google_business") return { gbpLocationId: settings.gbpLocationId, gbpTopicType: settings.gbpTopicType, gbpCtaType: settings.gbpCtaType, gbpCtaUrl: settings.gbpCtaUrl };
    return {};
  }

  async function publish() {
    if (disabled) return;
    setState("sending");
    setMessage("");
    try {
      const mediaUrl = video?.sourceUrl ?? videoUrl.trim();
      const payload = {
        socialMediaId: account.id,
        ...(title.trim() ? { title: title.trim() } : {}),
        caption: caption.trim(),
        ...(requestId ? { requestId } : {}),
        ...(image ? { asset: image } : mediaUrl ? { asset: { sourceUrl: mediaUrl, mimeType: (video?.mimeType ?? "video/mp4") as "video/mp4" | "video/webm" } } : {}),
        options: buildOptions(),
      };
      const response = await fetch("/api/developer/social-analytics/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as { errorCode?: string; postUrl?: string | null; requestId?: string | null; jobId?: string | null } | null;
      if (!response.ok) throw new Error(result?.errorCode ?? "upload_post_unavailable");
      setState("sent");
      setMessage(result?.postUrl ? "Gönderi yayınlandı: " + result.postUrl : result?.requestId ? "Upload-Post gönderiyi aldı. İstek: " + result.requestId : result?.jobId ? "Gönderi kuyruğa alındı. İş: " + result.jobId : "Gönderi Upload-Post’a iletildi.");
      onPublished?.();
      window.dispatchEvent(new CustomEvent("social-analytics:published", { detail: { accountId: account.id } }));
    } catch (error) {
      setState("error");
      setMessage(errorMessage(error instanceof Error ? error.message : "upload_post_unavailable"));
    }
  }

  return <div className="fixed inset-0 z-[120] overscroll-contain overflow-y-auto bg-[#172019]/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-label={theme.label + " gönderi oluştur"} aria-modal="true" ref={dialogRef}>
    <section className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-2xl bg-[#f7f8f4] shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:min-h-0">
      <header className="flex items-center justify-between gap-4 px-5 py-4 text-white sm:px-7" style={{ backgroundColor: theme.accent }}>
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><SocialPlatformBrandIcon platform={account.platform} className="size-5" /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">{theme.label} · gönderi oluştur</p><h2 className="truncate text-xl font-semibold">Yeni gönderi</h2></div></div>
        <button aria-label="Gönderi oluşturmayı kapat" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" disabled={state === "sending"} onClick={onClose} type="button"><X className="size-5" /></button>
      </header>
      <div className="border-b border-[#e2e7df] bg-white px-5 py-3 sm:px-7"><div className="flex items-center gap-2 text-sm text-[#536158]"><span className="size-2 rounded-full" style={{ backgroundColor: theme.accent }} /><span className="font-semibold">{account.accountName}</span><span className="text-[#a0aaa2]">·</span><span className="truncate">{account.profileUsername ? "@" + account.profileUsername : "Upload-Post hesabı"}</span></div></div>
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-2xl border border-[#e0e6dd] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: theme.accent }}><SocialPlatformBrandIcon platform={account.platform} className="size-5" /></span><div><h3 className="text-lg font-semibold text-[#26342b]">{key === "youtube" ? "Videonu yayınla" : key === "pinterest" ? "Yeni Pin oluştur" : theme.label + " gönderisi"}</h3><p className="mt-1 text-xs leading-5 text-[#7b867e]">Platformun paylaşım ekranına benzer şekilde hazırla ve Upload-Post üzerinden yayınla.</p></div></div>
          {isReddit ? <div className="mb-4 rounded-xl border border-[#edc7bc] bg-[#fff1ed] px-3 py-2.5 text-xs leading-5 text-[#8b3b2b]" role="alert">Upload-Post şu anda Reddit gönderilerini desteklemiyor. Bu hesap için yayınlama devre dışı.</div> : null}
          {copy.titleLabel ? <label className="mb-4 block text-xs font-semibold text-[#536158]"><span>{copy.titleLabel}{copy.titleRequired ? " *" : ""}</span><input className={fieldClass()} autoComplete="off" maxLength={500} name="title" onChange={(event) => { markDraftChanged(); setTitle(event.target.value); }} placeholder={copy.titlePlaceholder} value={title} /></label> : null}
          <label className="block text-xs font-semibold text-[#536158]"><span>{key === "x" ? "Gönderi metni" : "Açıklama"}{copy.titleRequired ? "" : " *"}</span><textarea className="mt-2 min-h-40 w-full resize-y rounded-xl border border-[#dce4da] bg-[#fbfcfa] p-3 text-sm leading-6 text-[#26342b] outline-none placeholder:text-[#a0aaa2] focus:border-[#7b9f85] focus-visible:ring-2 focus-visible:ring-[#7b9f85]/30" autoComplete="off" maxLength={copy.maxLength} name="caption" onChange={(event) => { markDraftChanged(); setCaption(event.target.value); }} placeholder={copy.placeholder} value={caption} /></label>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[#96a098]"><span>{hasMedia ? "Medya hazır" : requiresVideo || copy.mediaRequired ? "Medya gerekli" : "İsteğe bağlı medya"}</span><span className={caption.length > copy.maxLength ? "text-[#b34538]" : ""}>{caption.length.toLocaleString("tr-TR")}/{copy.maxLength.toLocaleString("tr-TR")}</span></div>
          {!isReddit ? <SettingsFields platform={key} settings={settings} update={updateSetting} /> : null}
          {requiresVideo ? <label className="mt-5 block text-xs font-semibold text-[#536158]"><span>Herkese açık video bağlantısı (isteğe bağlı)</span><div className="relative mt-2"><Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8d9a90]" /><input className={fieldClass() + " pl-9"} autoComplete="url" name="videoUrl" onChange={(event) => { markDraftChanged(); setVideo(undefined); setVideoUrl(event.target.value); }} placeholder="https://… (HTTPS video URL’si)" type="url" value={videoUrl} /></div><span className="mt-1.5 block text-[11px] font-normal leading-5 text-[#89938b]">Yerel video seçmek için aşağıdaki dosya alanını da kullanabilirsin.</span></label> : null}
          <div className="mt-5 rounded-xl border border-dashed border-[#cdd9cc] bg-[#f8faf7] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#405548]">{copy.mediaLabel}</p><p className="mt-1 text-[11px] leading-5 text-[#89938b]">{copy.videoOnly ? "MP4 veya WebM · en fazla 100 MB" : "PNG, JPEG, WebP, MP4 veya WebM · görsel 5 MB / video 100 MB"}</p></div><button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26342b]/40" onClick={() => fileInputRef.current?.click()} style={{ backgroundColor: theme.accent }} type="button"><ImagePlus className="size-4" />Dosya seç</button><input accept={copy.videoOnly ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp,video/mp4,video/webm"} className="hidden" name="media" onChange={(event) => void onFileChange(event.target.files?.[0])} ref={fileInputRef} type="file" /></div>{image || video ? <div className="mt-3 flex items-center gap-3 rounded-lg bg-white p-2">{video ? <video aria-label="Seçilen video" className="size-14 rounded-md object-cover" height={56} muted playsInline preload="metadata" src={video.sourceUrl} width={56} /> : <img alt="Seçilen medya" className="size-14 rounded-md object-cover" height={56} src={image?.dataUrl} width={56} />}<div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#405548]">{stagingVideo ? "Video hazırlanıyor…" : video ? "Video hazır" : "Görsel hazır"}</p><p className="text-[11px] text-[#89938b]">Gönderiye eklenecek</p></div><button aria-label="Seçilen medyayı kaldır" className="rounded-md p-1.5 text-[#89938b] hover:bg-[#eef2ec] hover:text-[#405548] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b9f85]/40" onClick={clearMedia} type="button"><X className="size-4" /></button></div> : null}</div>
          {message ? <div className={"mt-4 rounded-xl px-3 py-2.5 text-xs leading-5 " + (state === "sent" ? "bg-[#e6f4e9] text-[#287148]" : "bg-[#fff0ed] text-[#8b3b2b]")} role={state === "sent" ? "status" : "alert"}>{message}</div> : null}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-[#edf0eb] pt-5"><button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#718078] hover:bg-[#f1f4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7b9f85]/40" disabled={state === "sending"} onClick={onClose} type="button">Vazgeç</button><button className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26342b]/50" disabled={disabled} onClick={() => void publish()} style={{ backgroundColor: theme.accent }} type="button">{state === "sending" || stagingVideo ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{stagingVideo ? "Video hazırlanıyor…" : state === "sending" ? "Yayınlanıyor…" : state === "sent" ? "Tekrar yayınla" : "Yayınla"}</button></div>
        </div>
        <aside className="hidden lg:block"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#405548]"><Sparkles className="size-4" style={{ color: theme.accent }} />Canlı önizleme</div><Preview account={account} caption={caption} image={image?.dataUrl} platform={account.platform} title={title} video={video?.sourceUrl ?? (videoUrl.trim() || undefined)} /><p className="mt-3 text-[11px] leading-5 text-[#89938b]">Bu önizleme platforma göre yaklaşık görünümü gösterir. Son görünüm platformun kendi kurallarına göre değişebilir.</p></aside>
      </div>
    </section>
  </div>;
}
