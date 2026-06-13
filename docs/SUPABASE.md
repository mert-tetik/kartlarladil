# Supabase Notes

Guest kullanıcıların envanteri localStorage’da kalır. Authenticated kullanıcıların envanteri, quiz denemeleri, progress stats, puan ve rank bilgisi Supabase tablolarından türetilir.

## Environment Variables

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` sadece server tarafında kullanılır. Client dosyalarına veya `NEXT_PUBLIC_` değişkenlerine konmaz.

## Auth Routes

- `/login`: email/password login.
- `/register`: email/password registration.
- `/reset-password`: reset email gönderimi.
- `/account/update-password`: reset linki veya oturum içi şifre güncelleme.
- `/account/settings`: profil ve hesap yönetimi.
- `/auth/callback`: Supabase PKCE callback.

Guest kullanıcı user-owned write action yaptığında `/register?next=...` adresine yönlendirilir. `next` sadece internal path kabul eder.

Login/register default redirect hedefi `/card-draw` sayfasıdır.

## Schema

Migrationlar:

- `0001_initial_schema.sql`: temel tablo, RLS ve grant yapısı.
- `0002_user_profile_preferences.sql`: profil tercih alanları.
- `0003_multilingual_catalog_and_locale.sql`: 14 dil, locale tercihi ve yeni kart JSONB alanları.

Tablolar:

- `languages`: public dil metadata’sı.
- `cards`: public katalog.
- `user_profiles`: private kullanıcı profili ve tercihleri.
- `user_cards`: kullanıcı envanteri ve quiz progress’i.
- `practice_attempts`: quiz cevap geçmişi.

`cards` için önemli alanlar:

- `source_key`: app katalog anahtarı, import upsert key.
- `language_code`: 14 desteklenen dilden biri.
- `term_kind`: `word` veya `fixed_phrase`.
- `term`: ana kart terimi.
- `translation_tr`: eski Türkçe fallback.
- `translations jsonb`: tüm locale çevirileri.
- `examples jsonb`: 5 örnek ve örnek çevirileri.
- `grammar jsonb`: eski Türkçe fallback.
- `grammar_i18n jsonb`: tüm locale gramer anlatımları.

`user_profiles` için:

- `preferred_language_code`: öğrenme dili.
- `preferred_tier`: başlangıç tier’ı.
- `preferred_ui_locale`: arayüz dili.

## RLS

`languages` ve `cards` public read verisidir. `user_profiles`, `user_cards` ve `practice_attempts` sadece row sahibi tarafından okunur/yazılır:

```sql
using ((select auth.uid()) = user_id)
```

Migrationlar `anon` ve `authenticated` için explicit grants içerir. Supabase Data API exposure ayarları yine dashboard’dan kontrol edilmelidir.

## Catalog Import

Canlı inventory kullanmadan önce katalog import edilmelidir:

```bash
npm run supabase:import-cards
```

Script `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` ister. `languages` ve `cards` tablolarını `source_key` ile upsert eder.

Supabase `cards` tablosunda ilgili `source_key` bulunamazsa cloud action şu hatayı gösterir:

```text
Kart kataloğu Supabase’e aktarılmamış.
```

## Stats

Puan ve rank ayrı tabloya yazılmaz. Öğrenilmiş kartlar `user_cards.status = 'learned'` ve `cards.tier` üzerinden hesaplanır. Bu yapı duplicate puan ve client manipülasyonu riskini azaltır.
