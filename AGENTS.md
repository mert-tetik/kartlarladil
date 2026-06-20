# FoxiesDeck — Agent Guide

Bu doküman, FoxiesDeck projesinde çalışan AI kodlama ajanları için hazırlanmıştır. Proje hakkında ön bilgisi olmayan bir okuyucunun hızlıca bağlam kazanması hedeflenir. Aşağıdaki bilgiler mevcut kod tabanı, yapılandırma dosyaları ve testler incelenerek oluşturulmuştur; varsayımlara yer verilmemiştir.

## Proje Genel Bakış

**FoxiesDeck**, kullanıcıların çok dilli kelime haznesini koleksiyon kartlarıyla geliştirdiği bir Next.js uygulamasıdır. Kullanıcı kart çeker, kartı envanterine / haznesine ekler, quiz çözer ve tier eşiğini tamamlayan kartlar otomatik olarak öğrenilmiş olur.

Temel kavramlar:

- **Kart**: Bir dildeki tek bir kelimeyi (`termKind: "word"`) temsil eden katalog öğesi. Modelde `fixed_phrase` desteği vardır, ancak mevcut otomatik katalog 28.000 adet `word` kartından oluşur.
- **Tier**: `A1`, `A2`, `B1`, `B2`, `C1`.
- **Öğrenme**: Doğru cevap sayısı tier eşiğine ulaştığında kart otomatik `learned` olur; kullanıcı manuel olarak öğrenildi yapamaz. Kaynak kodundaki eşik değerleri:
  - `A1 = 4`
  - `A2 = 4`
  - `B1 = 6`
  - `B2 = 6`
  - `C1 = 8`
- **Yanlış cevap**: Doğru sayacını 1 azaltır, minimum `0`.
- **Puan / Rank**: Öğrenilmiş kartların tier puanlarından türetilir; ayrı mutable puan sayacı tutulmaz. Kaynak kodundaki puan değerleri:
  - `A1 = 10`
  - `A2 = 20`
  - `B1 = 40`
  - `B2 = 50`
  - `C1 = 100`
- **Rankler**: `baslangic` (0), `kart-ciragi` (200), `kelime-toplayici` (600), `dil-yolcusu` (1400), `akici-ogrenci` (2800), `kelime-ustasi` (7500), `cok-dilli` (13500), `seckin-koleksiyoncu` (22500), `dil-bilgesi` (36000), `efsane` (54000).

Uygulama 14 dil destekler: `tr`, `en`, `de`, `ru`, `fr`, `es`, `it`, `pt`, `nl`, `pl`, `ar`, `ja`, `ko`, `zh-CN`.

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16.2.7 App Router |
| React | 19.2.4 |
| Dil | TypeScript 5 (strict, `noEmit`) |
| Stil | Tailwind CSS 4 (`@tailwindcss/postcss`) |
| UI | shadcn/ui "New York" stili (`components.json`), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` |
| Yazı tipleri | Google Fonts: Manrope (body), Fraunces (display) |
| State (yerel) | Zustand + `localStorage` |
| Auth / DB | Supabase Auth (`@supabase/ssr`) + Supabase PostgreSQL (`@supabase/supabase-js`) |
| AI | OpenAI SDK, Responses API, varsayılan model `gpt-5-nano` |
| Ödeme | Lemon Squeezy webhook entegrasyonu |
| Doğrulama | Zod 4 |
| Birim test | Vitest 4 + jsdom + Testing Library |
| E2E test | Playwright 1.60 |

## Proje Yapısı

```text
src/
  app/              # Next.js App Router sayfaları ve route handler'ları
  components/       # Paylaşılan UI shell (navbar, footer, provider'lar) + ui/ primitive'leri
  data/             # Dil metadata'sı, tier tanımları, üretilmiş card-seeds/ katalogu
  features/         # Domain-driven modüller
  i18n/             # Locale yapılandırması, sözlükler, server/client locale yönetimi
  lib/              # Çapraz yardımcılar ve Supabase client ailesi
  test/             # Vitest setup ve mock'lar
  types/            # Merkezi domain TypeScript tipleri
```

### Domain Modülleri (`src/features/`)

Her modül kendi veri mantığını, bileşenlerini ve testlerini içerir:

- `cards/` — katalog, kart localization, kart çekme ve filtreleme, `VocabularyCardView`, `CardDetailsDialog`, `FilterControls`, `CardGrid`, `CardDrawWorkbench`.
- `inventory/` — yerel ve cloud envanter yönetimi, cloud Server Actions, envanter seçicileri.
- `quiz/` — quiz motoru (`quiz-engine.ts`), quiz istasyonu, cevap / eşik kuralları.
- `auth/` — login, register, reset password, profile update, logout, hesap silme, onboarding, auth şemaları ve session yardımcıları.
- `progress/` — puan, rank, ilerleme istatistikleri.
- `subscriptions/` — Lemon Squeezy entegrasyonu, haklar (entitlements), plan limitleri, webhook servisi.
- `themes/` — tema seçimi ve tema değişkenleri.
- `ai-practice/` — AI karakterleri, prompt'lar, streaming sohbet, puanlama.
- `ask/` — dil asistanı (Ask) sohbet akışı.
- `reviews/` — inceleme / geri bildirim bileşenleri.
- `legal/` — yasal sayfa bileşenleri.

### App Router (`src/app/`)

Route dosyaları mümkün olduğunca ince tutulur; iş mantığı `features/` içindedir. Önemli route'lar:

- `/` — landing page (dynamic, force-dynamic).
- `/card-draw` — kart çekme.
- `/my-cards` — envanter / hazne.
- `/learn` — quiz (aktif kartlar).
- `/learned` — öğrenilmiş kartlar.
- `/login`, `/register`, `/reset-password`, `/account/update-password`, `/account/settings` — auth.
- `/register/preferences` — onboarding (öğrenme dili, tier, UI locale seçimi).
- `/profile` — progress ve rank dashboard.
- `/ai-practice` → `/ai-practice/[language]` → `/ai-practice/[language]/[character]` — AI pratik sohbeti.
- `/ask/[language]` — dil asistanı.
- `/pricing`, `/account/subscription` — planlar ve abonelik yönetimi.
- `/terms`, `/privacy`, `/refund`, `/cookies`, `/subscriptions` — yasal sayfalar.
- `/api/ai-practice/chat`, `/api/ask/chat`, `/api/lemon-squeezy/webhook`, `/api/ai-practice/score`, `/api/ai-practice/translate` — API route handler'ları.
- `/auth/callback` — Supabase PKCE callback.

`next.config.ts` içinde eski Türkçe path'lerden İngilizce path'lere kalıcı yönlendirmeler vardır (`permanent: true`):

- `/kart-cek` → `/card-draw`
- `/kartlarim` → `/my-cards`
- `/ogren` → `/learn`
- `/ogrenilenler` → `/learned`
- `/profil` → `/profile`

Aynı mapping `src/features/auth/auth-redirects.ts` içindeki `getSafeNextPath()` tarafından da uygulanır.

### Katalog Veri Akışı

1. `scripts/generate-card-seeds-from-muse.mjs` MUSE sözlüklerinden `src/data/card-seeds/*.ts` üretir.
2. `src/data/cards.ts` seed satırlarından lazy `VocabularyCard` nesneleri oluşturur.
3. `localCardRepository` (`src/features/cards/card-repository.ts`) katalog üzerinde filtre, arama ve draw işlemleri yapar.
4. Misafir envanteri tarayıcıda `localStorage` anahtarı `foxiesdeck:v3` altında tutulur.
5. Giriş yapmış kullanıcı envanteri Supabase `user_cards` ve `practice_attempts` tablolarından gelir; kart kimliği olarak local `sourceKey` doğrudan `card_source_key` alanlarında tutulur.

## Build ve Test Komutları

```bash
# Bağımlılıklar
npm install

# Geliştirme sunucusu
npm run dev

# Üretim build'i
npm run build

# Build çıktısını çalıştırma
npm run start

# Lint
npm run lint

# TypeScript tip kontrolü
npm run typecheck

# Birim testler
npm run test
npm run test:watch

# E2E testler (önce build yapar)
npm run test:e2e

# Katalog raporu
npm run report:cards

```

Build için `next build` çalışır. E2E testleri Playwright çalıştırır; `playwright.config.ts` otomatik olarak `npm run start` ile `http://127.0.0.1:3000` üzerinde bir sunucu başlatır. `pretest:e2e` script'i `next build` çalıştırır.

Ek yardımcı script'ler `scripts/` altındadır: `generate-card-seeds-from-muse.mjs`, `report-cards.mjs`, `translate-*.ts`, `generate-localization-report.ts`, `analyze-missing-translations.ts`, `validate-translations.ts`, `generate-icons.mjs`, `visual-check.mjs`, `create-test-user.mjs`.

## Geliştirme Konvansiyonları

### TypeScript

- `tsconfig.json` içinde `strict: true`, `noEmit: true`, `isolatedModules: true`, `moduleResolution: "bundler"`, `skipLibCheck: true` etkindir.
- `@/*` takma adı `./src/*` anlamına gelir; import'larda kullanılır.
- Domain tipleri `src/types/domain.ts` içindedir; feature-local tipler ilgili modülde tutulur (örn. `src/features/auth/auth-types.ts`).
- `scripts/` dizini `tsconfig.json` dışındadır.

### Bileşen ve Dosya Düzeni

- Dosya adları kebab-case'dir.
- Server-first bileşenler varsayılandır; interaktif kod için `"use client"`, mutasyonlar için `"use server"` Server Actions kullanılır.
- `src/components/ui/` shadcn/ui uyumlu primitive'leri içerir: `button.tsx`, `badge.tsx`, `progress.tsx`.
- Her feature modülü kendi bileşenlerini ve testlerini yanında barındırır (`quiz-engine.test.ts`, `quiz-station.test.tsx` gibi).
- Component adları PascalCase; hook'lar `use` prefixli; Server Actions `Action` suffixli; sabitler UPPER_SNAKE_CASE.

### UI Sorumlulukları

- `VocabularyCardView` kartın tüm fiziksel/3D görünümünü sahiplenir.
- `CardDetailsDialog` 5 örnek ve gramer detayını gösterir.
- Quiz sırasında detaylar cevap verilmeden gösterilmez; cevap sonrası öğrenme desteği olarak açılır.
- `FilterControls` öğrenme dili/tier seçimini yapar; mobilde dil dropdown kullanır.
- `QuizStation` tüm quiz akışını sahiplenir (dil/tier seçimi, soru tipleri, sonuçlar).

### i18n

- URL prefix kullanılmaz. Locale cookie (`foxiesdeck:locale`) ve `localStorage` ile kalıcıdır; varsayılan locale `en`.
- `getServerLocale()` server tarafında cookie'den locale okur; root layout `<html lang>` ve `dir` değerlerini buna göre ayarlar.
- Arapça (`ar`) seçildiğinde `dir="rtl"` olur.
- `LocaleProvider` client tarafında cookie/localStorage günceller ve `useLocale()` / `useT()` sağlar.
- Türkçe (`tr`) tam baz sözlüktür. İngilizce onu override eder; diğer diller kısmi override'dir ve fallback zinciri `locale → en → tr` şeklindedir.
- Kart çevirileri `src/features/cards/card-localization.ts` üzerinden okunur. Öğrenme dili ile UI dili aynıysa quiz cevapları için fallback çalışma dili kullanılır: UI `en` ise `tr`, diğer aynı-dil durumlarında `en`.
- `src/i18n/labels.ts` dil/tier gösterim isimleri ve formatlama yardımcıları içerir.

### Kimlik Doğrulama ve Yetkilendirme

- `src/lib/supabase/` browser/server/admin/proxy client'larını içerir.
- `src/features/auth/actions.ts` auth mutation'larını sahiplenir: `loginAction`, `registerAction`, `resetPasswordAction`, `updatePasswordAction`, `updateProfileAction`, `signInWithGoogleAction`, `logoutAction`, `completeOnboardingAction`, `deleteAccountAction`, `updateThemeAction`.
- `src/features/auth/auth-session.ts`: `getCurrentAuthUser()`, `requireAuthUser(nextPath)`, `ensureUserProfile()`.
- `AuthSessionProvider` (`src/features/auth/auth-client.tsx`) `useAuthSession()` ve `useRequireAuthAction()` sağlar.
- Misafir kullanıcı, kart ekleme/quiz cevabı/envanter sıfırlama gibi user-owned işlemlerde `/register?next=...` adresine yönlendirilir. `next` sadece internal path kabul eder (`getSafeNextPath`).
- Login/register varsayılan yönlendirme hedefi `/card-draw`'dur (`DEFAULT_AUTH_REDIRECT`).
- Hesap silme ve webhook yazma gibi ayrıcalıklı işlemler `SUPABASE_SERVICE_ROLE_KEY` kullanan admin client ile yapılır.

### Form ve Hata İşlemleri

- Auth formları React 19 `useActionState` ile Server Actions'a bağlanır.
- `SubmitButton` `useFormStatus()` kullanır; `FormMessage` ve `FieldError` sunucu durumunu render eder.
- Zod şemaları Server Action'larda doğrulanır; hatalı gönderimler `createValidationErrorState()` ile localized field hatalarına dönüştürülür.
- AI route handler'ları JSON hata kodları döner: `auth_required`, `not_configured`, `invalid_request`, `unknown_character`, `upstream_error`, rate-limit kodları.

## Test Stratejisi

### Birim Testler (Vitest)

- Konfigürasyon: `vitest.config.ts`.
- Ortam: `jsdom`.
- Global API'ler etkindir (`globals: true`); timeout 20s.
- `@/` takma adı çözülür.
- `server-only` ve `next/navigation` için özel mock'lar `src/test/mocks/` altındadır.
- Setup dosyası: `src/test/setup.ts` (jest-dom matchers, `next/navigation` mock, subscription provider mock).
- E2E testleri (`tests/e2e/**`) hariç tutulur.

Önemli test alanları:

- `src/features/quiz/quiz-engine.test.ts` — öğrenme/eşik kuralları, envanter ekleme, quiz sorusu oluşturma.
- `src/features/quiz/components/quiz-station.test.tsx` — ses geri bildirimi, dil seçimi.
- `src/data/cards.test.ts` — katalog boyutu, term kuralları, ID'ler, çeviriler, örnekler, gramer kapsamı.
- `src/data/languages.test.ts` — dil metadata doğrulaması.
- `src/features/auth/*.test.ts` — auth yönlendirme ve şema kuralları.
- `src/features/ai-practice/*.test.ts` — AI prompt, şema, puanlama, fallback davranış.
- `src/features/subscriptions/*.test.ts` — abonelik ve webhook servisleri.
- `src/features/cards/components/*.test.tsx`, `src/features/inventory/components/*.test.tsx`, `src/components/cookie-notice.test.tsx`.

### E2E Testler (Playwright)

- Konfigürasyon: `playwright.config.ts`.
- Test dizini: `tests/e2e/`.
- Projeler: `desktop` (Desktop Chrome) ve `mobile` (Pixel 7).
- Temel URL: `http://127.0.0.1:3000`.
- Web sunucusu: `npm run start -- --hostname 127.0.0.1 --port 3000`.
- `pretest:e2e` script'i önce `next build` çalıştırır.
- Test dosyaları:
  - `tests/e2e/app.spec.ts` — landing, auth formları, card-draw filtreleri, misafir yönlendirmeleri, kart detayları, mobil navigasyon.
  - `tests/e2e/card-dark-preview.spec.ts` — dark tema kart ekran görüntüsü.
  - `tests/e2e/themes.spec.ts` — tema görsel regresyon matrisi (`/card-draw` ve `/pricing` üzerinde 20 tema).

## Ortam Değişkenleri

Geliştirme için `.env.local` dosyası oluşturulmalıdır. Şablon: `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_AI_PRACTICE_MODEL=gpt-5-nano
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_BASIC_VARIANT_ID=
LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID=
LEMONSQUEEZY_PRO_VARIANT_ID=
LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=https://foxiesdeck.vercel.app
```

- `SUPABASE_SERVICE_ROLE_KEY` ve `OPENAI_API_KEY` sadece server tarafında kullanılır. Asla client dosyalarına veya `NEXT_PUBLIC_` değişkenlerine konmaz.
- `OPENAI_AI_PRACTICE_MODEL` varsayılan değeri `gpt-5-nano`'dur.

## Supabase ve Veritabanı

- Proje ID: `foxiesdeck` (`supabase/config.toml`).
- Postgres sürümü: 17.
- Migrations: `supabase/migrations/` altında sıralı SQL dosyaları:
  - `0001_initial_schema.sql`
  - `0002_user_profile_preferences.sql`
  - `0003_multilingual_catalog_and_locale.sql`
  - `0004_subscriptions_and_ai_usage.sql`
  - `0005_subscription_enforcement.sql`
  - `0006_onboarding_flag.sql`
  - `0007_webhook_events.sql`
  - `0008_ai_practice_points.sql`
  - `0009_add_ask_usage_event.sql`
  - `0010_reviews.sql`
  - `0011_themes.sql`
  - `0012_chest_points.sql`
  - `0013_card_source_key_compat.sql`
  - `0014_remove_cards_catalog.sql`

Temel tablolar:

- `languages` — public dil metadata'sı.
- `user_profiles` — kullanıcı profili ve tercihleri (`preferred_language_code`, `preferred_tier`, `preferred_ui_locale`, `onboarding_completed`, `theme`, `ai_practice_points`).
- `user_cards` — kullanıcı envanteri ve quiz progress'i (`card_source_key` ile local katalog kartını referanslar).
- `practice_attempts` — quiz cevap geçmişi (`card_source_key` ile local katalog kartını referanslar).
- `user_subscriptions` — abonelik durumu.
- `ai_usage_events` — AI kullanım kayıtları.
- `ai_practice_scores` — AI pratik puanlama kayıtları.
- `webhook_events` — webhook duplicate önleme.
- `reviews` — kullanıcı yorumları.

RLS:

- `languages` public read verisidir (`anon` + `authenticated`).
- `user_profiles`, `user_cards`, `practice_attempts`, `ai_usage_events`, `user_subscriptions`, `ai_practice_scores` sadece satır sahibi tarafından okunur/yazılır (`auth.uid() = user_id`).
- `webhook_events` service role yazma; kullanıcı kendi satırlarını okuyabilir.
- `reviews` public read; authenticated kullanıcı kendi satırını insert/update edebilir.

Kart kataloğu uygulama bundle'ında tutulur. Supabase sadece kullanıcı state'ini saklar; cloud action'lar gelen `sourceKey` değerini local katalog üzerinden doğrular.

## Güvenlik Dikkatleri

- **Asla** `SUPABASE_SERVICE_ROLE_KEY` veya `OPENAI_API_KEY` değerlerini client tarafına, `NEXT_PUBLIC_` prefixli değişkenlere veya versiyon kontrolüne taşıma.
- Server Actions ve Route Handler'lar kullanıcı girdisini Zod şemaları ile doğrular.
- Misafir kullanıcıların user-owned write action'ları `useRequireAuthAction()` ile `/register?next=...` yönlendirmesiyle korunur.
- `next.config.ts` redirect'leri `permanent: true` olarak işaretlenmiştir; değişiklik yaparken SEO etkisini göz önünde bulundur.
- Supabase RLS politikaları varsayılan olarak kullanıcıya özel veri erişimini kısıtlar; yeni tablolar eklerken RLS politikalarını ve gerekli GRANT'ları tanımla.
- Cookie seçenekleri: `httpOnly: true`, `secure: production`, `sameSite: "lax"`, `maxAge: 365 gün`, `path: "/"`.

## Abonelikler ve Ödeme

- Ödeme sağlayıcısı: Lemon Squeezy.
- Planlar: `free`, `basic`, `pro`.
- Plan limitleri (`src/features/subscriptions/subscription-limits.ts`):

| Plan | Aktif kart | Öğrenilmiş kart | AI günlük | AI aylık |
|------|------------|-----------------|-----------|----------|
| free | 20 | 50 | 10 | 200 |
| basic | unlimited | unlimited | 30 | 900 |
| pro | unlimited | unlimited | 150 | 4500 |

- Webhook handler: `src/app/api/lemon-squeezy/webhook/route.ts` → `src/features/subscriptions/webhook-service.ts`.
- Webhook olayları `webhook_events` tablosunda duplicate önlemesi için saklanır.
- Checkout action: `src/features/subscriptions/subscription-actions.ts`.
- Haklar ve limit kontrolü: `src/features/subscriptions/subscription-service.ts`.

## Temalar

- Tailwind CSS v4 ile CSS variables (`src/app/globals.css`): `--brand`, `--background`, `--background-card`, `--foreground`, `--border`, vb.
- 10 marka teması, her biri light ve dark varyantı (toplam 20 tema): `default`, `ocean`, `emerald`, `violet`, `rose`, `amber`, `teal`, `indigo`, `crimson`, `lime`.
- Ücretsiz temalar: sadece `default` ve `default-dark`; diğerleri ücretli plan gerektirir.
- Tema ID'si `user_profiles.theme` alanında tutulur ve `data-theme` attribute'u ile uygulanır.

## AI Practice ve Ask Özellikleri

### AI Practice

- Route: `/ai-practice/[language]/[character]`.
- API: `POST /api/ai-practice/chat`.
- OpenAI Responses API `stream: true`, `store: false`, `reasoning: { effort: "minimal" }`, `max_output_tokens: 420`.
- Varsayılan model `gpt-5-nano`; `OPENAI_AI_PRACTICE_MODEL` ile değiştirilebilir.
- 10 karakter `src/features/ai-practice/ai-practice-data.ts` içinde tanımlıdır; her karakter tüm öğrenme dilleri için isim ve tüm UI locale'leri için özet tanımlar.
- Asset'ler `public/ai-characters/` içindedir.
- Prompt'lar: `src/features/ai-practice/ai-practice-prompts.ts`.
- Puanlama: `src/features/ai-practice/ai-practice-scoring.ts` + `/api/ai-practice/score`; puanlar `ai_practice_scores` ve atomik olarak `user_profiles.ai_practice_points` alanına eklenir.
- Konuşmalar sadece client state'te tutulur; sayfa yenilenince sıfırlanır.

### Ask

- Route: `/ask/[language]`.
- API: `POST /api/ask/chat`.
- Aynı streaming/OpenAI yapısını kullanır.
- UI locale'inde yanıt verir; örnekler hedef dilde kullanılır.
- Prompt'lar: `src/features/ask/ask-prompts.ts`.

### AI Kullanım Limitleri

`src/features/subscriptions/ai-usage-service.ts` tarafından `ai_usage_events` tablosundaki satırlar sayılarak uygulanır. Olay tipleri: `chat`, `translate`, `ask`.

## State Yönetimi

- Yerel envanter state'i Zustand + `localStorage` (`foxiesdeck:v3`) ile persist edilir.
- Store: `src/features/inventory/inventory-store.ts`.
- `cloudEnabled` true olduğunda store add/record/reset işlemlerini Server Actions'a devreder ve yanıttan local state'i günceller.
- Hydration tamamlanmadan envantere bağımlı UI render edilmez.

## Kullanışlı Referanslar

- `README.md` — yüksek seviye açıklama, tech stack, komutlar, ürün kuralları.
- `docs/ARCHITECTURE.md` — domain model, localization, data flow, learning/progress kuralları, UI/auth sınırları.
- `docs/SUPABASE.md` — environment, auth route'ları, schema, RLS, import talimatları.
- `docs/LEXICON_SOURCES.md` — MUSE kaynağı, katalog üretim kuralları, kalite notları.
- `docs/AI_PRACTICE.md` — AI Practice akışı, OpenAI Responses API kullanımı, prompt kuralları.
- `docs/LOCALIZATION_REPORT.md` — UI sözlük kapsamı, yasal çeviriler, AI practice localization durumu.
