"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Gem,
  GraduationCap,
  LoaderCircle,
  Search,
  ShieldAlert,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addUserCardAction,
  cancelUserSubscriptionAction,
  deleteUserWithConfirmationAction,
  grantUserSubscriptionAction,
  loadDeveloperUserDetailAction,
  searchDeveloperCatalogCardsAction,
} from "@/features/developer/developer-actions";
import type {
  DeveloperAuditLog,
  DeveloperCatalogCardMatch,
  DeveloperDashboardStats,
  DeveloperUserDetail,
  DeveloperUserPage,
  DeveloperUserSummary,
} from "@/features/developer/developer-types";

const numberFormatter = new Intl.NumberFormat("tr-TR");
const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const CREATION_DATE_FILTERS = [
  { value: "all", label: "Tüm hesaplar" },
  { value: "today", label: "Bugün" },
  { value: "last_2_days", label: "Son 2 gün" },
  { value: "last_3_days", label: "Son 3 gün" },
  { value: "this_week", label: "Bu hafta" },
  { value: "this_2_weeks", label: "Bu 2 hafta" },
  { value: "this_month", label: "Bu ay" },
] as const;
type CreationDateFilter = (typeof CREATION_DATE_FILTERS)[number]["value"];

const USER_SORT_OPTIONS = [
  ["createdAt", "Hesap açılışı"],
  ["lastSignInAt", "Son giriş"],
  ["emailConfirmedAt", "E-posta doğrulaması"],
  ["phoneConfirmedAt", "Telefon doğrulaması"],
  ["displayName", "Ad"],
  ["email", "E-posta"],
  ["providers", "Giriş sağlayıcıları"],
  ["preferredLanguage", "Öğrenme dili"],
  ["preferredUiLocale", "Arayüz dili"],
  ["preferredTier", "Seviye"],
  ["theme", "Tema"],
  ["profilePictureIndex", "Profil görseli"],
  ["leaderboardVisible", "Leaderboard görünürlüğü"],
  ["pushMarketingEnabled", "Pazarlama bildirimi"],
  ["onboardingCompleted", "Onboarding"],
  ["plan", "Plan"],
  ["status", "Abonelik durumu"],
  ["provider", "Abonelik kaynağı"],
  ["billingCycle", "Fatura döngüsü"],
  ["recurringPriceAmount", "Kaynak fiyatı"],
  ["recurringPriceCurrency", "Kaynak para birimi"],
  ["recurringMonthlyTry", "Aylık TL geliri"],
  ["autoRenewEnabled", "Otomatik yenileme"],
  ["renewsAt", "Yenileme tarihi"],
  ["endsAt", "Erişim bitişi"],
  ["subscriptionUpdatedAt", "Abonelik güncellemesi"],
  ["totalCards", "Toplam kart"],
  ["activeCards", "Öğrenilecek kart"],
  ["learnedCards", "Öğrenilmiş kart"],
  ["totalCorrectAnswers", "Doğru cevap"],
  ["firstCardAddedAt", "İlk kart tarihi"],
  ["lastCardProgressAt", "Son kart ilerlemesi"],
  ["totalAttempts", "Quiz denemesi"],
  ["firstAttemptAt", "İlk quiz tarihi"],
  ["lastAttemptAt", "Son quiz tarihi"],
  ["totalPoints", "Toplam puan"],
  ["aiPracticePoints", "AI Practice puanı"],
  ["chestPoints", "Sandık puanı"],
  ["streakPoints", "Quiz serisi puanı"],
  ["missionPoints", "Misyon puanı"],
  ["quizResultPoints", "Quiz sonucu puanı"],
  ["gamePoints", "Oyun puanı"],
  ["gemPoints", "Gem dönüşüm puanı"],
  ["blueGems", "Mavi gem"],
  ["greenGems", "Yeşil gem"],
  ["purpleGems", "Mor gem"],
] as const;
type UserSortKey = (typeof USER_SORT_OPTIONS)[number][0];
type UserSortDirection = "asc" | "desc";
const DATE_SORT_KEYS = new Set<UserSortKey>([
  "createdAt",
  "lastSignInAt",
  "emailConfirmedAt",
  "phoneConfirmedAt",
  "renewsAt",
  "endsAt",
  "subscriptionUpdatedAt",
  "firstCardAddedAt",
  "lastCardProgressAt",
  "firstAttemptAt",
  "lastAttemptAt",
]);

function formatDateTime(value: string | null | undefined) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

function getCreationFilterStart(filter: CreationDateFilter, now = new Date()) {
  if (filter === "all") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filter === "today") return start;
  if (filter === "last_2_days") {
    start.setDate(start.getDate() - 1);
    return start;
  }
  if (filter === "last_3_days") {
    start.setDate(start.getDate() - 2);
    return start;
  }
  if (filter === "this_week" || filter === "this_2_weeks") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset - (filter === "this_2_weeks" ? 7 : 0));
    return start;
  }
  start.setDate(1);
  return start;
}

function compareUsers(left: DeveloperUserSummary, right: DeveloperUserSummary, key: UserSortKey, direction: UserSortDirection) {
  let leftValue: unknown = left[key];
  let rightValue: unknown = right[key];
  if (Array.isArray(leftValue)) leftValue = leftValue.join(", ");
  if (Array.isArray(rightValue)) rightValue = rightValue.join(", ");
  if (leftValue === null || leftValue === undefined || leftValue === "") return rightValue === null || rightValue === undefined || rightValue === "" ? 0 : 1;
  if (rightValue === null || rightValue === undefined || rightValue === "") return -1;
  let result: number;
  if (DATE_SORT_KEYS.has(key)) {
    result = new Date(String(leftValue)).getTime() - new Date(String(rightValue)).getTime();
  } else if (typeof leftValue === "number" && typeof rightValue === "number") {
    result = leftValue - rightValue;
  } else if (typeof leftValue === "boolean" && typeof rightValue === "boolean") {
    result = Number(leftValue) - Number(rightValue);
  } else {
    result = String(leftValue).localeCompare(String(rightValue), "tr");
  }
  return direction === "asc" ? result : -result;
}

function getQuizAccuracy(user: DeveloperUserSummary) {
  if (!user.totalAttempts) return null;
  return Math.round((user.totalCorrectAnswers / user.totalAttempts) * 100);
}

export function AdminPanel({
  auditLogs,
  initialStats,
  initialUsers,
}: {
  auditLogs: DeveloperAuditLog[];
  initialStats: DeveloperDashboardStats;
  initialUsers: DeveloperUserPage;
}) {
  const userPage = initialUsers;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialUsers.users[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [creationFilter, setCreationFilter] = useState<CreationDateFilter>("all");
  const [sortKey, setSortKey] = useState<UserSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<UserSortDirection>("desc");
  const [listPage, setListPage] = useState(1);
  const [message, setMessage] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState<"basic" | "pro">(
    "basic",
  );
  const [durationDays, setDurationDays] = useState(30);
  const [sourceKey, setSourceKey] = useState("");
  const [catalogMatches, setCatalogMatches] = useState<
    DeveloperCatalogCardMatch[]
  >([]);
  const catalogSearchSequence = useRef(0);
  const [cardStatus, setCardStatus] = useState<"active" | "learned">("active");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pending, startTransition] = useTransition();

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filterStart = getCreationFilterStart(creationFilter);
    return userPage.users
      .filter((user) => {
        if (filterStart && new Date(user.createdAt) < filterStart) return false;
        if (!normalized) return true;
        return [user.email, user.displayName, user.id, user.plan, user.status]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized);
      })
      .sort((left, right) => compareUsers(left, right, sortKey, sortDirection));
  }, [creationFilter, query, sortDirection, sortKey, userPage.users]);
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / userPage.perPage));
  const currentPage = Math.min(listPage, totalPages);
  const displayedUsers = visibleUsers.slice(
    (currentPage - 1) * userPage.perPage,
    currentPage * userPage.perPage,
  );
  const selected =
    displayedUsers.find((user) => user.id === selectedId) ??
    displayedUsers[0] ??
    null;
  const [selectedDetail, setSelectedDetail] = useState<DeveloperUserDetail | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [detailError, setDetailError] = useState("");
  useEffect(() => {
    const userId = selected?.id ?? null;
    let current = true;
    void (async () => {
      await Promise.resolve();
      if (!current) return;
      if (!userId) {
        setSelectedDetail(null);
        setDetailPending(false);
        return;
      }

      setDetailError("");
      setDetailPending(true);
      try {
        const detail = await loadDeveloperUserDetailAction(userId);
        if (!current) return;
        setSelectedDetail(detail);
        setDetailPending(false);
      } catch {
        if (!current) return;
        setSelectedDetail(null);
        setDetailError("Kullanıcı detayları yüklenemedi.");
        setDetailPending(false);
      }
    })();

    return () => {
      current = false;
    };
  }, [selected?.id]);

  function grantSubscription() {
    if (!selected) return;
    startTransition(async () => {
      const response = await grantUserSubscriptionAction({
        userId: selected.id,
        plan: subscriptionPlan,
        durationDays,
      });
      setMessage(response.message);
      if (response.ok) window.location.reload();
    });
  }

  function cancelSubscription() {
    if (!selected) return;
    startTransition(async () => {
      const response = await cancelUserSubscriptionAction(selected.id);
      setMessage(response.message);
      if (response.ok) window.location.reload();
    });
  }

  function addCard() {
    if (!selected) return;
    startTransition(async () => {
      const response = await addUserCardAction({
        userId: selected.id,
        sourceKey,
        status: cardStatus,
      });
      setMessage(response.message);
      if (response.ok) {
        setSourceKey("");
        window.location.reload();
      }
    });
  }

  function searchCatalog(nextQuery: string) {
    setSourceKey(nextQuery);
    const requestId = ++catalogSearchSequence.current;
    if (nextQuery.trim().length < 2) {
      setCatalogMatches([]);
      return;
    }
    startTransition(async () => {
      try {
        const matches = await searchDeveloperCatalogCardsAction(nextQuery);
        if (requestId === catalogSearchSequence.current)
          setCatalogMatches(matches);
      } catch {
        if (requestId === catalogSearchSequence.current) setCatalogMatches([]);
      }
    });
  }

  function selectCatalogCard(card: DeveloperCatalogCardMatch) {
    catalogSearchSequence.current += 1;
    setSourceKey(card.sourceKey);
    setCatalogMatches([]);
  }

  function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const response = await deleteUserWithConfirmationAction({
        userId: selected.id,
        expectedEmail: selected.email,
        confirmation: deleteConfirmation,
        password: adminPassword,
      });
      setMessage(response.message);
      if (response.ok) {
        setDeleteOpen(false);
        window.location.reload();
      }
    });
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-6 text-[#1f2922] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[104rem]">
        <header className="border-b border-[#d9ddd4] pb-6">
          <a
            className="text-sm font-semibold text-[#4f6657] hover:underline"
            href="/developer"
          >
            Developer workspace
          </a>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight">
                Admin panel
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647168]">
                Kullanıcı durumları ve yüksek etkili işlemler sadece Supabase
                ile doğrulanmış admin oturumunda çalışır.
              </p>
            </div>
            <p className="text-xs leading-5 text-[#7c4d44]">
              Kullanıcı silme işlemi geri alınamaz; hedef e-posta onayı ve kendi
              Supabase parolan gerekir.
            </p>
          </div>
        </header>
        <section
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
          aria-label="Toplu istatistikler"
        >
          <Metric
            label="Toplam kullanıcı"
            value={numberFormatter.format(initialStats.totalUsers)}
          />
          <Metric
            label="Free / aktif hak yok"
            value={numberFormatter.format(initialStats.freeSubscribers)}
          />
          <Metric
            label="Basic abonelik"
            value={numberFormatter.format(initialStats.basicSubscribers)}
          />
          <Metric
            label="Pro abonelik"
            value={numberFormatter.format(initialStats.proSubscribers)}
          />
          <Metric
            label="Öğrenilecek kart"
            value={numberFormatter.format(initialStats.activeCards)}
          />
          <Metric
            label="Öğrenilmiş kart"
            value={numberFormatter.format(initialStats.learnedCards)}
          />
        </section>
        <section className="mt-3 flex flex-col gap-2 rounded-lg border border-[#d9ddd4] bg-[#e9efe5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[#526157]">
            Toplam kart kaydı:{" "}
            <strong>{numberFormatter.format(initialStats.totalCards)}</strong>
          </span>
          <span className="text-sm text-[#314d37]">
            Aylık tekrarlayan gelir:{" "}
            <strong>
              {tryFormatter.format(initialStats.monthlyRevenueTry)}
            </strong>
            <span className="ml-1 text-xs text-[#526157]">
              ({numberFormatter.format(initialStats.revenuePricedSubscribers)}{" "}
              doğrulanmış kayıt
              {initialStats.revenueUnpricedSubscribers > 0
                ? ` · ${numberFormatter.format(initialStats.revenueUnpricedSubscribers)} fiyat bilgisi bekliyor`
                : ""}
              )
            </span>
          </span>
        </section>
        <p className="mt-2 text-xs text-[#68756c]">
          Yalnızca otomatik yenilenen aktif Google Play abonelikleri dahil
          edilir; gösterilen tutar son doğrulamadaki yenileme fiyatının TL aylık
          karşılığıdır.
        </p>
        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 rounded-xl border border-[#d9ddd4] bg-[#fcfbf8]">
            <div className="flex flex-col gap-3 border-b border-[#d9ddd4] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Kullanıcılar</h2>
                <p className="mt-1 text-xs text-[#68756c]">
                  {numberFormatter.format(visibleUsers.length)} gösteriliyor ·{" "}
                  toplam {numberFormatter.format(userPage.total)} · Sayfa {currentPage} / {totalPages}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <label className="flex h-9 items-center gap-2 rounded-md border border-[#ccd4c9] bg-white px-2.5 text-[#6a756c] focus-within:border-[#71876f]">
                  <Search className="size-4" />
                  <input
                    className="w-44 bg-transparent text-sm text-[#1f2922] outline-none placeholder:text-[#9aa39b]"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setListPage(1);
                    }}
                    placeholder="Kullanıcılarda ara"
                    value={query}
                  />
                </label>
                <select
                  aria-label="Hesap açılış tarihi filtresi"
                  className="h-9 rounded-md border border-[#ccd4c9] bg-white px-2 text-sm text-[#34483a] outline-none focus:border-[#708770]"
                  onChange={(event) => {
                    setCreationFilter(event.target.value as CreationDateFilter);
                    setListPage(1);
                  }}
                  value={creationFilter}
                >
                  {CREATION_DATE_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  aria-label="Kullanıcı sıralama alanı"
                  className="h-9 max-w-52 rounded-md border border-[#ccd4c9] bg-white px-2 text-sm text-[#34483a] outline-none focus:border-[#708770]"
                  onChange={(event) => {
                    setSortKey(event.target.value as UserSortKey);
                    setListPage(1);
                  }}
                  value={sortKey}
                >
                  {USER_SORT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>Sırala: {label}</option>
                  ))}
                </select>
                <select
                  aria-label="Kullanıcı sıralama yönü"
                  className="h-9 rounded-md border border-[#ccd4c9] bg-white px-2 text-sm text-[#34483a] outline-none focus:border-[#708770]"
                  onChange={(event) => {
                    setSortDirection(event.target.value as UserSortDirection);
                    setListPage(1);
                  }}
                  value={sortDirection}
                >
                  <option value="desc">Azalan</option>
                  <option value="asc">Artan</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[790px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#d9ddd4] bg-[#efeee8] text-xs text-[#59675e]">
                    <th className="px-4 py-3 font-semibold">Kullanıcı</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Kartlar</th>
                    <th className="px-4 py-3 font-semibold">Toplam puan</th>
                    <th className="px-4 py-3 font-semibold">Quiz doğruluğu</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsers.map((user) => (
                    <tr
                      aria-label={`${user.email} kullanıcısını incele`}
                      aria-pressed={selected?.id === user.id}
                      className={`cursor-pointer border-b border-[#e5e6e0] outline-none transition-colors last:border-0 focus-visible:bg-[#e8f0e5] ${selected?.id === user.id ? "bg-[#eef4ea]" : "hover:bg-[#f7f8f4]"}`}
                      key={user.id}
                      onClick={() => setSelectedId(user.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(user.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {user.displayName ?? "İsimsiz kullanıcı"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6c786f]">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${user.plan === "pro" ? "bg-[#e6e1f3] text-[#443b76]" : user.plan === "basic" ? "bg-[#e6f0dc] text-[#315836]" : "bg-[#ecece7] text-[#60675f]"}`}
                        >
                          {user.plan} · {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#546259]">
                        <span>{user.activeCards} aktif</span>
                        <span className="mx-1.5 text-[#b1b8b0]">/</span>
                        <span>{user.learnedCards} öğrenilmiş</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#34483a]">
                          {numberFormatter.format(user.totalPoints)}
                        </span>
                        <span className="ml-1 text-xs text-[#7b857c]">puan</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#546259]">
                        {getQuizAccuracy(user) === null ? (
                          <span className="text-[#8a938b]">Henüz yok</span>
                        ) : (
                          <>
                            <span className="font-semibold text-[#34483a]">%{getQuizAccuracy(user)}</span>
                            <span className="ml-1 text-[#7b857c]">· {numberFormatter.format(user.totalAttempts)} deneme</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!visibleUsers.length ? (
                    <tr>
                      <td
                        className="px-4 py-10 text-center text-sm text-[#6d796f]"
                        colSpan={5}
                      >
                        Bu sayfada eşleşen kullanıcı yok.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-[#d9ddd4] p-3">
              <Button
                aria-label="Önceki kullanıcı sayfası"
                className="size-8 rounded-md border border-[#ccd4c9] bg-white p-0 text-[#405047] hover:bg-[#edf2e9]"
                disabled={pending || currentPage <= 1}
                onClick={() => setListPage(currentPage - 1)}
                type="button"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-[#6a756c]">
                {pending ? (
                  <LoaderCircle className="inline size-3.5 animate-spin" />
                ) : (
                  `Sayfa ${currentPage}`
                )}
              </span>
              <Button
                aria-label="Sonraki kullanıcı sayfası"
                className="size-8 rounded-md border border-[#ccd4c9] bg-white p-0 text-[#405047] hover:bg-[#edf2e9]"
                disabled={pending || currentPage >= totalPages}
                onClick={() => setListPage(currentPage + 1)}
                type="button"
              >
                <ChevronRight className="size-4" />
              </Button>
            </footer>
          </div>
          <UserControlPanel
            cardStatus={cardStatus}
            catalogMatches={catalogMatches}
            durationDays={durationDays}
            message={message}
            onAddCard={addCard}
            onCancelSubscription={cancelSubscription}
            onDelete={() => {
              setDeleteConfirmation("");
              setAdminPassword("");
              setDeleteOpen(true);
            }}
            onGrantSubscription={grantSubscription}
            onSearchCatalog={searchCatalog}
            onSelectCatalogCard={selectCatalogCard}
            onSetCardStatus={setCardStatus}
            onSetDurationDays={setDurationDays}
            onSetSubscriptionPlan={setSubscriptionPlan}
            pending={pending}
            selected={selected}
            selectedDetail={selectedDetail}
            detailError={detailError}
            detailPending={detailPending}
            sourceKey={sourceKey}
            subscriptionPlan={subscriptionPlan}
          />
        </section>
        <section className="mt-6 overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8]">
          <div className="flex items-center justify-between border-b border-[#d9ddd4] p-4">
            <div>
              <h2 className="text-lg font-semibold">Son admin işlemleri</h2>
              <p className="mt-1 text-xs text-[#68756c]">
                Silme ve abonelik değişiklikleri denetim kaydına yazılır.
              </p>
            </div>
            <ShieldAlert className="size-5 text-[#66786b]" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#e0e2dc] bg-[#efeee8] text-xs text-[#59675e]">
                  <th className="px-4 py-3 font-semibold">Zaman</th>
                  <th className="px-4 py-3 font-semibold">İşlem</th>
                  <th className="px-4 py-3 font-semibold">Admin</th>
                  <th className="px-4 py-3 font-semibold">Hedef kullanıcı</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr
                    className="border-b border-[#ecece7] last:border-0"
                    key={log.id}
                  >
                    <td className="px-4 py-3 text-xs text-[#667269]">
                      {dateFormatter.format(new Date(log.createdAt))}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#37483c]">
                      {log.action.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#59675e]">
                      {log.actorEmail}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6b776e]">
                      {log.targetUserId ?? "—"}
                    </td>
                  </tr>
                ))}
                {!auditLogs.length ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-sm text-[#6d796f]"
                      colSpan={4}
                    >
                      Henüz denetim kaydı yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {deleteOpen && selected ? (
        <DeleteUserDialog
          confirmation={deleteConfirmation}
          onClose={() => setDeleteOpen(false)}
          onConfirmationChange={setDeleteConfirmation}
          onPasswordChange={setAdminPassword}
          onSubmit={deleteUser}
          password={adminPassword}
          pending={pending}
          user={selected}
        />
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d9ddd4] bg-[#fcfbf8] p-4">
      <p className="text-xs text-[#6a766d]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function UserControlPanel({
  selected,
  subscriptionPlan,
  durationDays,
  sourceKey,
  catalogMatches,
  cardStatus,
  pending,
  message,
  onSetSubscriptionPlan,
  onSetDurationDays,
  onSearchCatalog,
  onSelectCatalogCard,
  onSetCardStatus,
  onGrantSubscription,
  onCancelSubscription,
  onAddCard,
  onDelete,
  selectedDetail,
  detailPending,
  detailError,
}: {
  selected: DeveloperUserSummary | null;
  subscriptionPlan: "basic" | "pro";
  durationDays: number;
  sourceKey: string;
  catalogMatches: DeveloperCatalogCardMatch[];
  cardStatus: "active" | "learned";
  pending: boolean;
  message: string;
  onSetSubscriptionPlan: (plan: "basic" | "pro") => void;
  onSetDurationDays: (days: number) => void;
  onSearchCatalog: (query: string) => void;
  onSelectCatalogCard: (card: DeveloperCatalogCardMatch) => void;
  onSetCardStatus: (status: "active" | "learned") => void;
  onGrantSubscription: () => void;
  onCancelSubscription: () => void;
  onAddCard: () => void;
  onDelete: () => void;
  selectedDetail: DeveloperUserDetail | null;
  detailPending: boolean;
  detailError: string;
}) {
  if (!selected)
    return (
      <aside className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5 text-sm text-[#6a766d]">
        İşlem yapmak için bir kullanıcı seç.
      </aside>
    );
  return (
    <aside className="h-fit rounded-xl border border-[#d9ddd4] bg-[#fcfbf8]">
      <div className="border-b border-[#d9ddd4] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-[#e9efe5] text-[#38543f]">
            <Users className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {selected.displayName ?? "İsimsiz kullanıcı"}
            </h2>
            <p className="mt-1 truncate text-xs text-[#68756c]">
              {selected.email}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#5d6a61]">
          <p>
            Dil{" "}
            <strong className="text-[#273a2d]">
              {selected.preferredLanguage ?? "—"}
            </strong>
          </p>
          <p>
            Seviye{" "}
            <strong className="text-[#273a2d]">
              {selected.preferredTier ?? "—"}
            </strong>
          </p>
          <p>
            Onboarding{" "}
            <strong className="text-[#273a2d]">
              {selected.onboardingCompleted ? "Tamam" : "Bekliyor"}
            </strong>
          </p>
          <p>
            Sağlayıcı{" "}
            <strong className="text-[#273a2d]">
              {selected.provider ?? "—"}
            </strong>
          </p>
        </div>
      </div>
      <UserDetailOverview
        detail={selectedDetail}
        error={detailError}
        pending={detailPending}
      />
      <section className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-[#45614b]" />
          Abonelik yönetimi
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            className="h-9 rounded-md border border-[#ccd4c9] bg-white px-2 text-sm outline-none focus:border-[#708770]"
            onChange={(event) =>
              onSetSubscriptionPlan(event.target.value as "basic" | "pro")
            }
            value={subscriptionPlan}
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
          <input
            className="h-9 rounded-md border border-[#ccd4c9] bg-white px-2 text-sm outline-none focus:border-[#708770]"
            min="1"
            onChange={(event) =>
              onSetDurationDays(Number(event.target.value) || 1)
            }
            type="number"
            value={durationDays}
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-[#6b776e]">
          Süre gün cinsindedir. Google Play aboneliği iptal edilirse yalnızca
          yenileme durur; erişim dönem sonunda biter.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            className="h-9 flex-1 rounded-md border-transparent bg-[#dfead8] text-sm text-[#245132] hover:bg-[#cfe0c7]"
            disabled={pending}
            onClick={onGrantSubscription}
            type="button"
          >
            Planı ata
          </Button>
          <Button
            className="h-9 rounded-md border border-[#d9bdb4] bg-white px-3 text-sm text-[#844338] hover:bg-[#f8e9e5]"
            disabled={pending}
            onClick={onCancelSubscription}
            type="button"
          >
            İptal et
          </Button>
        </div>
      </section>
      <section className="border-t border-[#d9ddd4] p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="size-4 text-[#45614b]" />
          Kart ekle
        </h3>
        <div className="relative mt-3">
          <label className="sr-only" htmlFor="admin-card-search">
            {"Katalog kart\u0131 ara"}
          </label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-[#ccd4c9] bg-white px-2 text-[#5b6c61] focus-within:border-[#708770]">
            <BookOpen className="size-4" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-[#1f2922] outline-none placeholder:text-[#93a098]"
              id="admin-card-search"
              onChange={(event) => onSearchCatalog(event.target.value)}
              placeholder={"Kelime, \u00e7eviri veya source key ara"}
              value={sourceKey}
            />
          </div>
          {catalogMatches.length ? (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-[#cad3c7] bg-white p-1 shadow-sm">
              {catalogMatches.map((card) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-[#edf2e9]"
                  key={card.sourceKey}
                  onClick={() => onSelectCatalogCard(card)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#273a2d]">
                      {card.term}
                    </span>
                    <span className="block truncate text-xs text-[#657269]">
                      {card.translation}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[#677a68]">
                    {card.language}
                    {" \u00b7 "}
                    {card.tier}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <select
          className="mt-2 h-9 w-full rounded-md border border-[#ccd4c9] bg-white px-2 text-sm outline-none focus:border-[#708770]"
          onChange={(event) =>
            onSetCardStatus(event.target.value as "active" | "learned")
          }
          value={cardStatus}
        >
          <option value="active">Öğrenilecek olarak ekle</option>
          <option value="learned">Öğrenilmiş olarak ekle</option>
        </select>
        <Button
          className="mt-2 h-9 w-full rounded-md border-transparent bg-[#e7ecf5] text-sm text-[#394e73] hover:bg-[#dce5f1]"
          disabled={pending || !sourceKey.trim()}
          onClick={onAddCard}
          type="button"
        >
          Kartı ekle
        </Button>
      </section>
      <section className="border-t border-[#e5cfca] bg-[#fff8f6] p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#783b31]">
          <ShieldAlert className="size-4" />
          Tehlikeli işlem
        </h3>
        <p className="mt-2 text-xs leading-5 text-[#7a5b55]">
          Bu işlem kullanıcı hesabını ve ilişkili ilerleme verilerini kalıcı
          olarak kaldırır.
        </p>
        <Button
          className="mt-3 h-9 w-full rounded-md border border-[#dbb4aa] bg-white text-sm text-[#883d31] hover:bg-[#fae8e3]"
          disabled={pending}
          onClick={onDelete}
          type="button"
        >
          <Trash2 className="size-4" />
          Kullanıcıyı sil
        </Button>
      </section>
      {message ? (
        <p
          className="border-t border-[#d9ddd4] px-5 py-3 text-xs leading-5 text-[#536158]"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </aside>
  );
}

function UserDetailOverview({
  detail,
  pending,
  error,
}: {
  detail: DeveloperUserDetail | null;
  pending: boolean;
  error: string;
}) {
  if (pending) {
    return (
      <div className="space-y-3 border-b border-[#d9ddd4] p-5" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#4d6254]">
          <LoaderCircle className="size-4 animate-spin" />
          Kullanıcı detayları yükleniyor…
        </div>
        <div className="h-16 animate-pulse rounded-lg bg-[#eef1eb]" />
        <div className="h-24 animate-pulse rounded-lg bg-[#eef1eb]" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="border-b border-[#d9ddd4] p-5 text-xs leading-5 text-[#8a493d]" role="alert">
        {error}
      </p>
    );
  }

  if (!detail) return null;

  return (
    <div className="max-h-[72vh] overflow-y-auto border-b border-[#d9ddd4]">
      <DetailSection icon={<CircleAlert className="size-4" />} title="Hesap ve profil">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label="Hesap açılışı" value={formatDateTime(detail.createdAt)} />
          <DetailField label="Son giriş" value={formatDateTime(detail.lastSignInAt)} />
          <DetailField label="E-posta doğrulaması" value={formatDateTime(detail.auth.emailConfirmedAt)} />
          <DetailField label="Telefon doğrulaması" value={formatDateTime(detail.auth.phoneConfirmedAt)} />
          <DetailField label="Giriş sağlayıcıları" value={detail.auth.providers.join(", ") || "—"} />
          <DetailField label="Arayüz dili" value={detail.profile.preferredUiLocale ?? "—"} />
          <DetailField label="Tema" value={detail.profile.theme ?? "—"} />
          <DetailField label="Profil görseli" value={detail.profile.profilePictureIndex === null ? "—" : `#${detail.profile.profilePictureIndex}`} />
          <DetailField label="Onboarding" value={detail.onboardingCompleted ? "Tamamlandı" : "Tamamlanmadı"} />
          <DetailField label="Liderlik tablosu" value={detail.profile.leaderboardVisible ? "Görünür" : "Gizli"} />
          <DetailField label="Pazarlama bildirimi" value={detail.profile.pushMarketingEnabled ? "Açık" : "Kapalı"} />
          <DetailField label="Kullanıcı ID" value={detail.id} mono />
        </div>
      </DetailSection>

      <DetailSection icon={<BookOpen className="size-4" />} title="Öğrenme durumu">
        <div className="grid grid-cols-3 gap-2">
          <DetailStat label="Toplam kart" value={detail.cards.total} />
          <DetailStat label="Öğrenilecek" value={detail.cards.active} />
          <DetailStat label="Öğrenilmiş" value={detail.cards.learned} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label="Doğru cevap" value={numberFormatter.format(detail.cards.totalCorrect)} />
          <DetailField label="İlk kart" value={formatDateTime(detail.cards.firstAddedAt)} />
          <DetailField label="Son ilerleme" value={formatDateTime(detail.cards.lastProgressAt)} />
          <DetailField label="Kart puanı" value={numberFormatter.format(detail.pointSources[0]?.points ?? 0)} />
        </div>
        <div className="mt-4 space-y-2">
          {detail.cards.byTier.map((tier) => (
            <div className="flex items-center justify-between text-xs" key={tier.tier}>
              <span className="font-semibold text-[#3f5547]">{tier.tier}</span>
              <span className="text-[#68756c]">
                {tier.learned}/{tier.total} öğrenilmiş · {numberFormatter.format(tier.points)} puan
              </span>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection icon={<Activity className="size-4" />} title="Kullanım aktivitesi">
        <div className="grid grid-cols-3 gap-2">
          <DetailStat label="Deneme" value={detail.activity.totalAttempts} />
          <DetailStat label="Doğru" value={detail.activity.correctAttempts} />
          <DetailStat label="Yanlış" value={detail.activity.incorrectAttempts} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label="İlk quiz" value={formatDateTime(detail.activity.firstAttemptAt)} />
          <DetailField label="Son quiz" value={formatDateTime(detail.activity.lastAttemptAt)} />
        </div>
      </DetailSection>

      <DetailSection icon={<CreditCard className="size-4" />} title="Abonelik durumu">
        {detail.subscription ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <DetailField label="Plan / durum" value={`${detail.subscription.plan} · ${detail.subscription.status}`} />
            <DetailField label="Kaynak" value={detail.subscription.provider ?? "—"} />
            <DetailField label="Döngü" value={detail.subscription.billingCycle ?? "—"} />
            <DetailField label="Otomatik yenileme" value={detail.subscription.autoRenewEnabled ? "Açık" : "Kapalı"} />
            <DetailField label="Yenileme" value={formatDateTime(detail.subscription.renewsAt)} />
            <DetailField label="Erişim bitişi" value={formatDateTime(detail.subscription.endsAt)} />
            <DetailField
              label="Kaynak fiyatı"
              value={detail.subscription.recurringPriceAmount === null ? "—" : `${detail.subscription.recurringPriceAmount} ${detail.subscription.recurringPriceCurrency ?? ""}`.trim()}
            />
            <DetailField
              label="Aylık TL karşılığı"
              value={detail.subscription.recurringMonthlyTry === null ? "—" : tryFormatter.format(detail.subscription.recurringMonthlyTry)}
            />
            <DetailField label="Son güncelleme" value={formatDateTime(detail.subscription.updatedAt)} />
          </div>
        ) : (
          <p className="text-xs text-[#68756c]">Bu kullanıcı için abonelik kaydı yok; ücretsiz plan.</p>
        )}
      </DetailSection>

      <DetailSection icon={<Trophy className="size-4" />} title="Puan özeti">
        <div className="flex items-end justify-between rounded-lg bg-[#eef4ea] p-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#637568]">Toplam puan</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#294b33]">
              {numberFormatter.format(detail.totalPoints)}
            </p>
          </div>
          <p className="text-right text-xs font-semibold text-[#4c6654]">
            {detail.rank.label}
            <span className="mt-1 block font-normal text-[#718074]">{numberFormatter.format(detail.rank.minPoints)} taban</span>
          </p>
        </div>
        <div className="mt-3 space-y-2">
          {detail.pointSources.map((source) => (
            <div className="rounded-md border border-[#e1e5de] px-3 py-2" key={source.key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#3c5143]">{source.label}</span>
                <span className="font-semibold tabular-nums text-[#294b33]">{numberFormatter.format(source.points)}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#748078]">
                {source.eventCount === null
                  ? "Profil sayacından hesaplandı"
                  : `${numberFormatter.format(source.eventCount)} kayıt${source.lastEarnedAt ? ` · son ${formatDateTime(source.lastEarnedAt)}` : ""}`}
              </p>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection icon={<Gem className="size-4" />} title="Bakiye ve diğer sinyaller">
        <div className="grid grid-cols-3 gap-2">
          <DetailStat label="Mavi gem" value={detail.profile.blueGems} />
          <DetailStat label="Yeşil gem" value={detail.profile.greenGems} />
          <DetailStat label="Mor gem" value={detail.profile.purpleGems} />
        </div>
      </DetailSection>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#e5e8e2] p-5 last:border-b-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#334a3b]">
        <span className="text-[#45614b]">{icon}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[#7a857d]">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-medium text-[#34483a] ${mono ? "font-mono text-[10px]" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[#f1f4ef] px-2 py-2 text-center">
      <p className="text-[10px] text-[#748078]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[#344d3a]">
        {numberFormatter.format(value)}
      </p>
    </div>
  );
}

function DeleteUserDialog({
  user,
  confirmation,
  password,
  pending,
  onClose,
  onConfirmationChange,
  onPasswordChange,
  onSubmit,
}: {
  user: DeveloperUserSummary;
  confirmation: string;
  password: string;
  pending: boolean;
  onClose: () => void;
  onConfirmationChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const expected = `DELETE ${user.email}`;
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#172018]/45 p-4"
      role="dialog"
    >
      <form
        className="w-full max-w-md rounded-xl border border-[#d8bcb4] bg-[#fffaf8] p-6 shadow-sm"
        onSubmit={onSubmit}
      >
        <div className="flex items-center gap-3 text-[#863d31]">
          <CircleAlert className="size-6" />
          <h2 className="text-xl font-semibold">Kullanıcıyı kalıcı sil</h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#694f49]">
          <strong>{user.email}</strong> hesabı, kartları ve ilişkili verileri
          silinecek. Bu işlem geri alınamaz.
        </p>
        <label className="mt-5 block text-sm font-semibold text-[#503d39]">
          Onay metni
        </label>
        <p className="mt-1 text-xs text-[#7d645e]">
          Tam olarak şunu yaz:{" "}
          <code className="rounded bg-[#f4e7e3] px-1">{expected}</code>
        </p>
        <input
          className="mt-2 h-10 w-full rounded-md border border-[#d7bbb3] bg-white px-3 text-sm outline-none focus:border-[#a85345]"
          onChange={(event) => onConfirmationChange(event.target.value)}
          value={confirmation}
        />
        <label className="mt-4 block text-sm font-semibold text-[#503d39]">
          Kendi Supabase admin parolan
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 h-10 w-full rounded-md border border-[#d7bbb3] bg-white px-3 text-sm outline-none focus:border-[#a85345]"
          onChange={(event) => onPasswordChange(event.target.value)}
          type="password"
          value={password}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button
            className="h-9 rounded-md border border-[#cfd5cd] bg-white px-4 text-sm text-[#415047] hover:bg-[#f0f3ee]"
            onClick={onClose}
            type="button"
          >
            Vazgeç
          </Button>
          <Button
            className="h-9 rounded-md border-transparent bg-[#a74b3d] px-4 text-sm text-white hover:bg-[#8e3d31]"
            disabled={pending || confirmation !== expected || !password}
            type="submit"
          >
            {pending ? "Doğrulanıyor…" : "Kalıcı olarak sil"}
          </Button>
        </div>
      </form>
    </div>
  );
}
