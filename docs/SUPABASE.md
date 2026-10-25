# Supabase Notes

Guest kullanicilarin envanteri localStorage'da kalir. Authenticated kullanicilarin envanteri, quiz denemeleri, progress stats, puan ve rank bilgisi Supabase tablolarindan turetilir.

## Environment Variables

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` sadece server tarafinda kullanilir. Client dosyalarina veya `NEXT_PUBLIC_` degiskenlerine konmaz.

## Auth Routes

- `/login`: email/password login.
- `/register`: email/password registration.
- `/reset-password`: reset email gonderimi.
- `/account/update-password`: reset linki veya oturum ici sifre guncelleme.
- `/account/settings`: profil ve hesap yonetimi.
- `/auth/callback`: Supabase PKCE callback.

Guest kullanici user-owned write action yaptiginda `/register?next=...` adresine yonlendirilir. `next` sadece internal path kabul eder.

Login/register default redirect hedefi `/card-draw` sayfasidir.

## Schema

Migrationlar `supabase/migrations/` altinda tutulur. Ancak bu klasor production'da guvenle bastan oynatilabilecek bir seri degildir: production migration ledger'i su anda yalnizca `20261024233100` kaydini iceriyor; yerel klasorde `0015`, `0016` ve `0024` icin yinelenen legacy version'lar var. Supabase CLI ile production'a migration uygulamadan, dosya isimlerini degistirmeden veya migration history'yi repair etmeden once production schema'sini tarihsel tum migration'larla karsilastirip incelenmis bir baseline olustur. Ayrintilar: `docs/SUBSCRIPTION_PRODUCTION_RUNBOOK.md`.

### Image text translation quota migration

The current image/text translation quota and reservation implementation is
covered by
`20261024233100_subscription_entitlement_expiry_and_image_quota_reservations.sql`.
Production already contains the reservation table and server-only RPCs. Do not
run `supabase db push` to apply this migration until the production migration
history has been reconciled as described in
`docs/SUBSCRIPTION_PRODUCTION_RUNBOOK.md`.

After deployment, verify both routines exist in the `public` schema:

```sql
select p.oid::regprocedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'record_ai_usage_if_within_limit',
    'record_image_text_translation_if_available'
  );
```

The image translation routine serializes per-user reservations and allows
Free/Basic users two lifetime successful translations; Pro bypasses that cap.
The application records the reservation only after OpenAI output passes schema
validation.

Tablolar:

- `languages`: public dil metadata'si.
- `user_profiles`: private kullanici profili ve tercihleri.
- `user_cards`: kullanici envanteri ve quiz progress'i (`card_source_key` ile local katalog kartina baglanir).
- `practice_attempts`: quiz cevap gecmisi (`card_source_key` ile local katalog kartina baglanir).
- `user_subscriptions`: Google Play veya sureli admin subscription state'i. Lemon Squeezy kolonlari tarihî uyumluluk alanlaridir.
- `ai_usage_events`: AI chat/translate/ask kullanim kayitlari.
- `webhook_events`: legacy webhook idempotency verisi.

`user_profiles` icin:

- `preferred_language_code`: ogrenme dili.
- `preferred_tier`: kayitli tier tercihi (`A1`-`C1` veya `all`).
- `preferred_ui_locale`: arayuz dili.

## RLS

`languages` public read verisidir. `user_profiles`, `user_cards` ve `practice_attempts` sadece row sahibi tarafindan okunur/yazilir:

```sql
using ((select auth.uid()) = user_id)
```

Her tablo icin grant ve RLS birlikte degerlendirilmelidir. Abonelik, Google Play purchase token/event ve quota tablolarinda RLS aciktir; `anon` ve `authenticated` rollerine dogrudan tablo erisimi verilmez. Supabase Data API exposure ayarlari yine dashboard'dan kontrol edilmelidir.

## Catalog Contract

Kart katalogu artik uygulama bundle'inda yasar. Supabase sadece kullanici state'ini tutar. Cloud action'lar gelen `sourceKey` degerini server bundle icindeki local katalog ile dogrular ve sadece `card_source_key` yazar.

## Subscription Operations

Etkin abonelik saglayicisi Google Play Billing'dir; uygulama satin alma ve restore verisini server-side Google Play API ile dogrulamadan entitlement vermez. Yenileme/iptal gibi durumlar imzali Pub/Sub OIDC push'u ile `/api/google-play/rtdn` endpoint'ine gelir. Admin grant'leri zaman sinirlidir. Lemon Squeezy schema kolonlari ve eski migration'lar yeni abonelik veya entitlement saglamaz.

Production checklist, replay, reconciliation, monitoring ve secret rotation adimlari icin `docs/SUBSCRIPTION_PRODUCTION_RUNBOOK.md` kullanilir.

## Stats

Puan ve rank ayri tabloya yazilmaz. Ogrenilmis kartlar `user_cards.status = 'learned'` ve app icindeki local katalog tier bilgisi uzerinden hesaplanir. Bu yapi duplicate puan ve client manipilasyonu riskini azaltir.
