export const AUTOMATION_SCHEDULED_AT_IN_PAST_CODE = "automation_scheduled_at_in_past";

/**
 * PostgREST `neq` excludes NULL rows. Schedule errors are NULL for outputs that
 * have never been attempted, so the lock query must explicitly include NULL.
 */
export const SCHEDULE_RETRY_ERROR_OR_FILTER =
  `schedule_error_code.is.null,schedule_error_code.neq.${AUTOMATION_SCHEDULED_AT_IN_PAST_CODE}`;

const SCHEDULE_FAILURE_REASONS: Record<string, string> = {
  automation_caption_missing: "Bu içerikte açıklama metni olmadığı için schedule edilemedi.",
  automation_media_missing: "İçeriğin medya dosyası bulunamadı.",
  automation_media_read_failed: "Medya dosyası okunamadı. Storage bağlantısını ve dosyanın varlığını kontrol et.",
  automation_media_store_failed: "Medya dosyası hazırlanan Storage alanına kaydedilemedi.",
  automation_media_url_failed: "Upload-Post için medya bağlantısı oluşturulamadı.",
  automation_schedule_attempt_interrupted: "Schedule işlemi yarıda kesilmiş. Güvenli olması için tekrar deneyebilirsin.",
  automation_schedule_claim_conflict: "Hazır içerikler bu istek tarafından alınamadı; başka bir işlem durumlarını değiştirmiş olabilir. İçerik durumunu yenileyip tekrar dene.",
  automation_schedule_date_invalid: "Schedule tarihi geçerli bir tarih değil.",
  automation_schedule_lock_failed: "Schedule edilecek kayıtlar veritabanında kilitlenemedi. Biraz sonra tekrar dene.",
  automation_schedule_provider_recheck_failed: "Önceki Upload-Post isteğinin durumu doğrulanamadı.",
  automation_schedule_recovery_failed: "Yarım kalan schedule işleminin kurtarma kontrolü başarısız oldu.",
  automation_schedule_reservations_failed: "Hesapların mevcut schedule takvimi okunamadı; çakışmayı önlemek için gönderim durduruldu.",
  automation_schedule_run_read_failed: "Toplu üretim kaydı okunamadı.",
  automation_schedule_run_update_failed: "Toplu üretim schedule durumu kaydedilemedi.",
  automation_schedule_run_not_found: "Toplu üretim kaydı bulunamadı veya bu hesaba ait değil.",
  automation_schedule_failed: "Schedule işlemi beklenmeyen bir nedenle başarısız oldu.",
  automation_schedule_slot_unavailable: "Bu hesaplarda uygun bir schedule saati bulunamadı.",
  automation_run_not_found: "Toplu üretim kaydı bulunamadı veya bu hesaba ait değil.",
  automation_runs_unavailable: "Toplu üretim kayıtlarına veritabanından ulaşılamadı. Biraz sonra tekrar dene.",
  automation_scheduled_at_in_past: "İçeriğin schedule saati geçmiş. Gelecekte bir saat seçip tekrar dene.",
  automation_target_missing: "Bu içerik için hedef sosyal medya hesabı seçilmemiş.",
  invalid_media: "Medya dosyası Upload-Post tarafından kabul edilebilir biçimde değil.",
  invalid_scheduled_date: "Upload-Post schedule tarihini geçersiz buldu.",
  upload_post_carousel_limit: "Carousel, hedef sosyal platformun medya sayısı sınırını aşıyor.",
  upload_post_job_id_missing: "Upload-Post isteği için doğrulanabilir bir schedule kimliği alınamadı.",
  upload_post_not_configured: "Upload-Post bağlantı ayarları eksik.",
  upload_post_profile_not_configured: "Hedef Upload-Post profili bağlı veya yapılandırılmış değil.",
  upload_post_rate_limited: "Upload-Post istek sınırına takıldı. Biraz bekleyip tekrar dene.",
  upload_post_reddit_unavailable: "Reddit için Upload-Post bağlantısı şu anda kullanılamıyor.",
  upload_post_request_unconfirmed: "Upload-Post isteğinin sonucu henüz doğrulanmadı; olası çift paylaşımı önlemek için yeniden gönderilmedi.",
  upload_post_unsupported_content: "Bu içerik türü seçilen sosyal platformda desteklenmiyor.",
};

function isMachineCode(value: string) {
  return /^[a-z][a-z\d_]{2,119}$/u.test(value);
}

export function isScheduleErrorEligible(errorCode: string | null | undefined) {
  return errorCode !== AUTOMATION_SCHEDULED_AT_IN_PAST_CODE;
}

export function getAutomationScheduleFailureReason(errorCode?: string | null, errorDetail?: string | null) {
  const code = errorCode?.trim() || "";
  const detail = errorDetail?.trim() || "";

  if (detail && detail !== code) {
    if (isMachineCode(detail)) {
      return SCHEDULE_FAILURE_REASONS[detail] ?? `Teknik hata kodu: ${detail}`;
    }
    return detail;
  }

  if (code) return SCHEDULE_FAILURE_REASONS[code] ?? `Teknik hata kodu: ${code}`;
  return "Schedule başarısız oldu; hata ayrıntısı sağlayıcı tarafından verilmedi.";
}
