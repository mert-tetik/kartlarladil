# FoxiesDeck — Agent Guide

Bu doküman, FoxiesDeck projesinde çalışan AI kodlama ajanları için hazırlanmıştır. Proje hakkında ön bilgisi olmayan bir okuyucunun hızlıca bağlam kazanması hedeflenir.

## Proje Genel Bakış

**FoxiesDeck**, kullanıcıların çok dilli kelime haznesini koleksiyon kartlarıyla geliştirdiği bir Next.js uygulamasıdır. Kullanıcı kart çeker, kartı envanterine ekler, quiz çözer ve tier eşiğini tamamlayan kartlar otomatik olarak öğrenilmiş olur.

Tema kavramları:

- Kart: bir dildeki tek bir kelimeyi (`termKind: "word"`) temsil eden katalog öğesi. Modelde `fixed_phrase` desteği vardır, ancak mevcut otomatik katalog 28.000 adet `word` kartından oluşur.
- Tier: A1, A2, B1, B2, C1.
- Öğrenme: doğru cevap sayısı tier eşiğine ulaştığında (`A1=2`, `A2=3`, `B1=4`, `B2=5`, `C1=6`) kart otomatik `learned` olur; kullanıcı manuel olarak öğrenildi yapamaz.
- Puan / rank: öğrenilmiş kartların tier puanlarından türetilir; ayrı mutable puan sayacı tutulmaz (`A1=10`, `A2=20`, `B1=40`, `B2=70`, `C1=110`).

Uygulama 14 dil destekler: `tr`, `en`, `de`, `ru`, `fr`, `es`, `it`, `pt`, `nl`, `pl`, `ar`, `ja`, `ko`, `zh-CN`.

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 16.2.7 App Router |
| React | 19.2.4 |
| Dil | TypeScript 5 (strict) |
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

- `cards/` — katalog, kart localization, kart çekme ve filtreleme, `VocabularyCardView`
- `inventory/` — yerel ve cloud envanter yönetimi
- `quiz/` — quiz motoru (`quiz-engine.ts`), quiz istasyonu, cevap / eşik kuralları
- `auth/` — login, register, reset password, profile update, logout, hesap silme
- `progress/` — puan, rank, ilerleme istatistikleri
- `subscriptions/` — Lemon Squeezy entegrasyonu, haklar (entitlements), AI usage
- `themes/` — tema seçimi ve tema değişkenleri
- `ai-practice/` — AI karakterleri ve pratik sohbet akışı
- `ask/` — dil asistanı (Ask) sohbet akışı
- `reviews/` — inceleme / geri bildirim bileşenleri
- `legal/` — yasal sayfa bileşenleri

### App Router (`src/app/`)

Route dosyaları mümkün olduğunca ince tutulur; iş mantığı `features/` içindedir. Önemli route'lar:

- `/card-draw` — kart çekme
- `/my-cards` — envanter
- `/learn` — quiz
- `/learned` — öğrenilmiş kartlar
- `/profile`, `/account/settings` — profil ve hesap yönetimi
- `/ai-practice/[language]/[character]` — AI pratik sohbeti
- `/ask/[language]` — dil asistanı
- `/api/ai-practice/chat`, `/api/ask`, `/api/lemon-squeezy` — API route handler'ları

`next.config.ts` içinde eski Türkçe path'lerden İngilizce path'lere kalıcı yönlendirmeler vardır (örn. `/kart-cek` → `/card-draw`).

### Katalog Veri Akışı

1. `scripts/generate-card-seeds-from-muse.mjs` MUSE sözlüklerinden `src/data/card-seeds/*.ts` üretir.
2. `src/data/cards.ts` seed satırlarından lazy `VocabularyCard` nesneleri oluşturur.
3. `localCardRepository` katalog üzerinde filtre, arama ve draw işlemleri yapar.
4. Misafir envanteri tarayıcıda `localStorage` anahtarı `foxiesdeck:v3` altında tutulur.
5. Giriş yapmış kullanıcı envanteri Supabase `user_cards` ve `practice_attempts` tablolarından gelir.

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

# Supabase'e katalog importu
npm run supabase:import-cards
```

Build için `next build` çalışır. E2E testleri Playwright çalıştırır; `playwright.config.ts` otomatik olarak `npm run start` ile `http://127.0.0.1:3000` üzerinde bir sunucu başlatır.

## Geliştirme Konvansiyonları

### TypeScript

- `tsconfig.json` içinde `strict: true`, `noEmit`, `isolatedModules: true`, `moduleResolution: "bundler"` etkindir.
- `@/*` takma adı `./src/*` anlamına gelir; import'larda kullanılır.
- Domain tipleri `src/types/domain.ts` içindedir.

### Bileşen ve Dosya Düzeni

- Dosya adları kebab-case'dir.
- Server-first bileşenler varsayılandır; interaktif kod için `"use client"`, mutasyonlar için `"use server"` Server Actions kullanılır.
- `src/components/ui/` shadcn/ui uyumlu primitive'leri içerir.
- Her feature modülü kendi bileşenlerini ve testlerini yanında barındırır (`quiz-engine.test.ts`, `quiz-station.test.tsx` gibi).

### UI Sorumlulukları

- `VocabularyCardView` kartın tüm fiziksel/3D görünümünü sahiplenir.
- `CardDetailsDialog` 5 örnek ve gramer detayını gösterir.
- Quiz sırasında detaylar cevap verilmeden gösterilmez; cevap sonrası öğrenme desteği olarak açılır.
- `FilterControls` öğrenme dili/tier seçimini yapar; mobilde dil dropdown kullanır.

### i18n

- URL prefix kullanılmaz. Locale cookie ve `localStorage` ile kalıcıdır.
- `getServerLocale()` server tarafında cookie'den locale okur; root layout `<html lang>` ve `dir` değerlerini buna göre ayarlar.
- `LocaleProvider` client tarafında cookie/localStorage günceller.
- `useT()` UI sözlük stringlerini verir.
- Türkçe (`tr`) tam baz sözlüktür. İngilizce onu override eder; diğer diller kısmi override'dir ve fallback zinciri `locale → en → tr` şeklindedir.
- Kart çevirileri `src/features/cards/card-localization.ts` üzerinden okunur.

### Kimlik Doğrulama ve Yetkilendirme

- `src/lib/supabase/` browser/server/admin/proxy client'larını içerir.
- `src/features/auth/actions.ts` auth mutation'larını sahiplenir.
- Misafir kullanıcı, kart ekleme/quiz cevabı/envanter sıfırlama gibi user-owned işlemlerde `/register?next=...` adresine yönlendirilir. `next` sadece internal path kabul eder.
- Login/register varsayılan yönlendirme hedefi `/card-draw`'dur.

## Test Stratejisi

### Birim Testler (Vitest)

- Konfigürasyon: `vitest.config.ts`
- Ortam: `jsdom`
- Global API'ler etkindir (`globals: true`).
- `@/` takma adı çözülür.
- `server-only` ve `next/navigation` için özel mock'lar `src/test/mocks/` altındadır.
- Setup dosyası: `src/test/setup.ts`
- E2E testleri (`tests/e2e/**`) hariç tutulur.

Önemli test alanları:

- `src/features/quiz/quiz-engine.test.ts` — öğrenme/eşik kuralları
- `src/data/cards.test.ts` — katalog doğrulama
- `src/features/auth/*.test.ts` — auth yönlendirme ve şema kuralları
- `src/features/ai-practice/*.test.ts` — AI prompt, şema, puanlama
- `src/features/subscriptions/*.test.ts` — abonelik ve webhook servisleri

### E2E Testler (Playwright)

- Konfigürasyon: `playwright.config.ts`
- Test dizini: `tests/e2e/`
- Projeler: `desktop` (Desktop Chrome) ve `mobile` (Pixel 7)
- Temel URL: `http://127.0.0.1:3000`
- Web sunucusu: `npm run start -- --hostname 127.0.0.1 --port 3000`
- `pretest:e2e` script'i önce `next build` çalıştırır.

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
```

- `SUPABASE_SERVICE_ROLE_KEY` ve `OPENAI_API_KEY` sadece server tarafında kullanılır. Asla client dosyalarına veya `NEXT_PUBLIC_` değişkenlerine konmaz.
- `OPENAI_AI_PRACTICE_MODEL` varsayılan değeri `gpt-5-nano`'dur.

## Supabase ve Veritabanı

- Proje ID: `foxiesdeck` (`supabase/config.toml`)
- Postgres sürümü: 17
- Migrations: `supabase/migrations/` altında sıralı SQL dosyaları.

Temel tablolar:

- `languages` — public dil metadata'sı
- `cards` — public katalog (`source_key`, `language_code`, `term_kind`, `term`, `translations jsonb`, `examples jsonb`, `grammar_i18n jsonb`)
- `user_profiles` — kullanıcı profili ve tercihleri (`preferred_language_code`, `preferred_tier`, `preferred_ui_locale`)
- `user_cards` — kullanıcı envanteri ve quiz progress'i
- `practice_attempts` — quiz cevap geçmişi

RLS:

- `languages` ve `cards` public read verisidir.
- `user_profiles`, `user_cards`, `practice_attempts` sadece satır sahibi tarafından okunur/yazılır (`auth.uid() = user_id`).

Canlı envanter kullanmadan önce katalog Supabase'e aktarılmalıdır:

```bash
npm run supabase:import-cards
```

Eğer `cards` tablosunda ilgili `source_key` bulunmazsa cloud action şu hatayı döner: "Kart kataloğu Supabase'e aktarılmamış."

## Güvenlik Dikkatleri

- **Asla** `SUPABASE_SERVICE_ROLE_KEY` veya `OPENAI_API_KEY` değerlerini client tarafına, `NEXT_PUBLIC_` prefixli değişkenlere veya versiyon kontrolüne taşıma.
- Server Actions ve Route Handler'lar kullanıcı girdisini Zod şemaları ile doğrular.
- Misafir kullanıcıların user-owned write action'ları `useRequireAuthAction()` ile `/register?next=...` yönlendirmesiyle korunur.
- `next.config.ts` redirect'leri `permanent: true` olarak işaretlenmiştir; değişiklik yaparken SEO etkisini göz önünde bulundur.
- Supabase RLS politikaları varsayılan olarak kullanıcıya özel veri erişimini kısıtlar; yeni tablolar eklerken RLS politikalarını ve gerekli GRANT'ları tanımla.

## AI Practice ve Ask Özellikleri

- AI Practice: `/ai-practice/[language]/[character]` route'u, `POST /api/ai-practice/chat`. OpenAI Responses API `stream: true`, `store: false`. Konuşmalar sadece client state'te tutulur; sayfa yenilenince sıfırlanır.
- Ask: `/ask/[language]` route'u, `POST /api/ask`. Dil öğrenme asistanı sohbeti.
- Karakter asset'leri `public/ai-characters/` içindedir.
- Her karakter tüm desteklenen öğrenme dilleri için isim ve tüm UI locale'leri için özet tanımlamalıdır.

## Kullanışlı Referanslar

- `README.md` — yüksek seviye açıklama, tech stack, komutlar, ürün kuralları
- `docs/ARCHITECTURE.md` — domain model, localization, data flow, learning/progress kuralları, UI/auth sınırları
- `docs/SUPABASE.md` — environment, auth route'ları, schema, RLS, import talimatları
- `docs/LEXICON_SOURCES.md` — MUSE kaynağı, katalog üretim kuralları, kalite notları
- `docs/AI_PRACTICE.md` — AI Practice akışı, OpenAI Responses API kullanımı, prompt kuralları
