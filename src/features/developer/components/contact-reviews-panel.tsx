"use client";

import { type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Inbox,
  Mail,
  MessageSquareText,
  Star,
} from "lucide-react";
import { ProfilePicture } from "@/features/auth/components/profile-picture";
import type { DeveloperContactReview } from "@/features/developer/developer-types";

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ContactReviewsPanel({ initialReviews }: { initialReviews: DeveloperContactReview[] }) {
  const averageRating = initialReviews.length
    ? initialReviews.reduce((total, review) => total + review.rating, 0) / initialReviews.length
    : 0;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-6 text-[#1f2922] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[104rem]">
        <header className="border-b border-[#d9ddd4] pb-6">
          <a className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f6657] hover:underline" href="/developer">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Developer workspace
          </a>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Contact us mesajları</h1>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="İletişim istatistikleri">
          <Metric tone="bg-[#e11d48]" label="Toplam mesaj" value={String(initialReviews.length)} icon={<MessageSquareText className="size-4" aria-hidden="true" />} />
          <Metric tone="bg-[#7c3aed]" label="Ortalama puan" value={averageRating ? averageRating.toFixed(1) : "—"} icon={<Star className="size-4" aria-hidden="true" />} />
          <Metric tone="bg-[#0891b2]" label="Son gönderim" value={initialReviews[0] ? formatDateTime(initialReviews[0].createdAt) : "—"} icon={<CalendarDays className="size-4" aria-hidden="true" />} />
        </section>

        <section className="mt-5 grid gap-4" aria-label="Contact us mesaj listesi">
          {initialReviews.length ? (
            initialReviews.map((review) => <ContactReviewCard key={review.id} review={review} />)
          ) : (
            <div className="rounded-xl border border-dashed border-[#c8d0c5] bg-[#fcfbf8] px-6 py-14 text-center">
              <Inbox className="mx-auto size-9 text-[#87958a]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold text-[#33483a]">Mesaj bulunamadı</h2>
              <p className="mt-2 text-sm text-[#68756c]">Henüz gönderilmiş bir Contact us mesajı yok.</p>
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
    <article className="rounded-xl bg-black p-5 text-white">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProfilePicture profilePictureIndex={review.profilePictureIndex} alt="" className="size-11 rounded-full border border-white/30 bg-white/10" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white">{sender}</h2>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-white/70">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {review.email ?? "E-posta bilgisi yok"}
            </p>
          </div>
        </div>
        <Rating value={review.rating} />
      </header>

      <div className="mt-5 rounded-lg bg-white px-4 py-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-black">
          {review.comment.trim() || "Kullanıcı mesaj bırakmadı."}
        </p>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 border-t border-white/20 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
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
          className={index < value ? "size-4 fill-[#f5b91b] text-[#f5b91b]" : "size-4 text-white/45"}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-white/75">{value}/5</span>
    </div>
  );
}

function Metric({ tone, label, value, icon }: { tone: string; label: string; value: string; icon: ReactNode }) {
  return (
    <div className={`rounded-xl ${tone} p-4 text-white`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-white">
        <span className="text-white">{icon}</span>
        {label}
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-white/60">{label}</dt>
      <dd className={`mt-0.5 truncate font-medium text-white ${mono ? "font-mono text-[10px]" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}
