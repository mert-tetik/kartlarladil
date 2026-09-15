"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Inbox,
  Mail,
  MessageSquareText,
  Search,
  Star,
} from "lucide-react";
import { ProfilePicture } from "@/features/auth/components/profile-picture";
import type { DeveloperContactReview } from "@/features/developer/developer-types";

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

export function ContactReviewsPanel({ initialReviews }: { initialReviews: DeveloperContactReview[] }) {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

  const visibleReviews = useMemo(() => {
    return initialReviews.filter((review) => {
      if (ratingFilter !== "all" && review.rating !== Number(ratingFilter)) return false;
      if (!normalizedQuery) return true;

      return [
        review.email,
        review.displayName,
        review.userId,
        review.comment,
        review.preferredLanguage,
        review.preferredUiLocale,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery);
    });
  }, [initialReviews, normalizedQuery, ratingFilter]);

  const averageRating = initialReviews.length
    ? initialReviews.reduce((total, review) => total + review.rating, 0) / initialReviews.length
    : 0;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-6 text-[#1f2922] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[104rem]">
        <header className="border-b border-[#d9ddd4] pb-6">
          <a className="text-sm font-semibold text-[#4f6657] hover:underline" href="/developer/admin">
            Admin panel
          </a>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-[#e8e7f6] text-[#39346f]">
                  <Inbox className="size-6" aria-hidden="true" />
                </span>
                <h1 className="font-display text-4xl font-semibold tracking-tight">Contact us mesajları</h1>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#647168]">
                Kullanıcıların landing sayfasındaki iletişim alanından gönderdiği puan ve mesajları incele.
              </p>
            </div>
            <a
              href="/developer"
              className="inline-flex items-center gap-2 self-start rounded-md border border-[#ccd4c9] bg-[#fcfbf8] px-3 py-2 text-sm font-semibold text-[#405548] transition-colors hover:bg-white lg:self-auto"
            >
              Developer workspace
            </a>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="İletişim istatistikleri">
          <Metric label="Toplam mesaj" value={String(initialReviews.length)} icon={<MessageSquareText className="size-4" aria-hidden="true" />} />
          <Metric label="Ortalama puan" value={averageRating ? averageRating.toFixed(1) : "—"} icon={<Star className="size-4" aria-hidden="true" />} />
          <Metric label="Son gönderim" value={initialReviews[0] ? formatDateTime(initialReviews[0].createdAt) : "—"} icon={<CalendarDays className="size-4" aria-hidden="true" />} />
        </section>

        <section className="mt-6 rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-4" aria-label="Mesaj filtreleri">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#ccd4c9] bg-white px-3 text-[#6a756c] focus-within:border-[#71876f]">
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Mesajlarda ara</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-[#1f2922] outline-none placeholder:text-[#9aa39b]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="E-posta, isim veya mesajda ara"
                value={query}
              />
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm text-[#68756c]">
              <span className="shrink-0">Puan</span>
              <select
                className="h-10 rounded-md border border-[#ccd4c9] bg-white px-3 text-sm font-semibold text-[#1f2922] outline-none focus:border-[#71876f]"
                onChange={(event) => setRatingFilter(event.target.value as RatingFilter)}
                value={ratingFilter}
              >
                <option value="all">Tümü</option>
                <option value="5">5 yıldız</option>
                <option value="4">4 yıldız</option>
                <option value="3">3 yıldız</option>
                <option value="2">2 yıldız</option>
                <option value="1">1 yıldız</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-[#68756c]">
            {visibleReviews.length} mesaj gösteriliyor · Supabase&apos;de kayıtlı toplam {initialReviews.length} mesaj
          </p>
        </section>

        <section className="mt-5 grid gap-4" aria-label="Contact us mesaj listesi">
          {visibleReviews.length ? (
            visibleReviews.map((review) => <ContactReviewCard key={review.id} review={review} />)
          ) : (
            <div className="rounded-xl border border-dashed border-[#c8d0c5] bg-[#fcfbf8] px-6 py-14 text-center">
              <Inbox className="mx-auto size-9 text-[#87958a]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-[#33483a]">Mesaj bulunamadı</h2>
              <p className="mt-2 text-sm text-[#68756c]">Arama veya puan filtresini değiştirip tekrar dene.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ContactReviewCard({ review }: { review: DeveloperContactReview }) {
  const sender = review.displayName?.trim() || review.email || "E-posta bilgisi yok";

  return (
    <article className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProfilePicture profilePictureIndex={review.profilePictureIndex} alt="" className="size-11 rounded-full border border-[#d9ddd4] bg-[#eef2ea]" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[#25382b]">{sender}</h2>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[#68756c]">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {review.email ?? "E-posta bilgisi yok"}
            </p>
          </div>
        </div>
        <Rating value={review.rating} />
      </header>

      <div className="mt-5 rounded-lg border border-[#e1e5de] bg-white px-4 py-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#33483a]">
          {review.comment.trim() || "Kullanıcı mesaj bırakmadı."}
        </p>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-[#e5e8e2] pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Gönderim" value={formatDateTime(review.createdAt)} />
        <InfoItem label="Güncelleme" value={formatDateTime(review.updatedAt)} />
        <InfoItem label="Öğrenme dili" value={review.preferredLanguage ?? "—"} />
        <InfoItem label="Arayüz dili" value={review.preferredUiLocale ?? "—"} />
        <InfoItem label="Kullanıcı ID" value={review.userId} mono />
        <InfoItem label="Mesaj ID" value={review.id} mono />
      </dl>
    </article>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-label={`${value} / 5 yıldız`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={index < value ? "size-4 fill-[#d59c27] text-[#d59c27]" : "size-4 text-[#c6cec4]"}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-[#68756c]">{value}/5</span>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#68756c]">
        <span className="text-[#506756]">{icon}</span>
        {label}
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-[#25382b]">{value}</p>
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[#7a857d]">{label}</dt>
      <dd className={`mt-0.5 truncate font-medium text-[#405548] ${mono ? "font-mono text-[10px]" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}
