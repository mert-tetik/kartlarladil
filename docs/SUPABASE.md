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
- `0003_multilingual_catalog_and_locale.sql`: 14 dil ve locale tercihi.
- `0013_card_source_key_compat.sql`: `card_source_key` uyumluluk kolonları ve backfill.
- `0014_remove_cards_catalog.sql`: `public.cards` kaldırımı ve source key cleanup'ı.

Tablolar:

- `languages`: public dil metadata'sı.
- `user_profiles`: private kullanıcı profili ve tercihleri.
- `user_cards`: kullanıcı envanteri ve quiz progress’i (`card_source_key` ile local katalog kartına bağlanır).
- `practice_attempts`: quiz cevap geçmişi (`card_source_key` ile local katalog kartına bağlanır).

`user_profiles` için:

- `preferred_language_code`: öğrenme dili.
- `preferred_tier`: başlangıç tier’ı.
- `preferred_ui_locale`: arayüz dili.

## RLS

`languages` public read verisidir. `user_profiles`, `user_cards` ve `practice_attempts` sadece row sahibi tarafından okunur/yazılır:

```sql
using ((select auth.uid()) = user_id)
```

Migrationlar `anon` ve `authenticated` için explicit grants içerir. Supabase Data API exposure ayarları yine dashboard’dan kontrol edilmelidir.

## Catalog Contract

Kart kataloğu artık uygulama bundle'ında yaşar. Supabase sadece kullanıcı state'ini tutar. Cloud action'lar gelen `sourceKey` değerini server bundle içindeki local katalog ile doğrular ve sadece `card_source_key` yazar.

## Stats

Puan ve rank ayrı tabloya yazılmaz. Öğrenilmiş kartlar `user_cards.status = 'learned'` ve app içindeki local katalog tier bilgisi üzerinden hesaplanır. Bu yapı duplicate puan ve client manipülasyonu riskini azaltır.
