/*
 * Copyright 2024 FoxiesDeck
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package __PACKAGE__;

import android.app.Application;
import android.content.pm.ApplicationInfo;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import com.facebook.FacebookSdk;
import com.facebook.LoggingBehavior;
import com.facebook.appevents.AppEventsLogger;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Locale;

/** Sends the allowlisted WebView event contract to Meta App Events. */
public final class NativeMetaAnalytics {
    private static final String TAG = "FoxiesDeckMeta";
    private static final String ENABLED_VALUE = "true";
    private static final int MAX_PARAMETER_COUNT = 24;
    private static final int MAX_PARAMETER_VALUE_LENGTH = 100;
    private static volatile AppEventsLogger logger;

    private NativeMetaAnalytics() {}

    public static void initialize(Application application) {
        if (!isEnabled(application) || !ensureLogger(application)) {
            return;
        }

        try {
            if (isDebugBuild(application)) {
                FacebookSdk.setIsDebugEnabled(true);
                FacebookSdk.addLoggingBehavior(LoggingBehavior.APP_EVENTS);
                Log.i(TAG, "Meta App Events SDK initialized");
            }
            AppEventsLogger.activateApp(application);
            // AutoLogAppEventsEnabled is intentionally disabled because this
            // app forwards an explicit allowlist. Log the activation event
            // ourselves so the SDK marks the session as activated before the
            // first manual event is written.
            logger.logEvent("fb_mobile_activate_app");
            flushEvents();
        } catch (Exception ignored) {
            // Meta analytics must never affect application startup.
        }
    }

    public static void logEvent(Context context, String sourceEvent, Bundle sourceParams) {
        if (sourceEvent == null
                || sourceEvent.isEmpty()
                || "set_user_id".equals(sourceEvent)
                || "fd_app_open".equals(sourceEvent)
                || "fd_engagement_pulse".equals(sourceEvent)) {
            return;
        }

        String eventName = mapEventName(sourceEvent);
        if (eventName == null) {
            if (isDebugBuild(context)) {
                Log.i(TAG, "Event ignored by Meta allowlist: " + sourceEvent);
            }
            return;
        }
        if (!ensureLogger(context)) {
            if (isDebugBuild(context)) {
                Log.w(TAG, "Meta logger unavailable for event: " + eventName);
            }
            return;
        }

        Bundle params = sanitizeParameters(sourceParams);
        if ("fd_subscription_purchase".equals(sourceEvent)) {
            BigDecimal value = parsePurchaseValue(params.getString("value"));
            Currency currency = parseCurrency(params.getString("currency"));
            if (value != null && currency != null) {
                try {
                    logger.logPurchase(value, currency, params);
                    flushEvents();
                    return;
                } catch (Exception ignored) {
                    // Fall through to a regular event if the SDK rejects the purchase payload.
                }
            }
        }

        try {
            logger.logEvent(eventName, params);
            flushEvents();
            if (isDebugBuild(context)) {
                Log.i(TAG, "Meta event queued and flushed: " + eventName);
            }
        } catch (Exception ignored) {
            if (isDebugBuild(context)) {
                Log.w(TAG, "Meta event failed: " + eventName + " (" + ignored.getClass().getSimpleName() + ")");
            }
            // Analytics is best-effort and must not interrupt the WebView flow.
        }
    }

    private static void flushEvents() {
        try {
            if (logger != null) {
                logger.flush();
            }
        } catch (Exception ignored) {
            // Analytics is best-effort and must not interrupt the WebView flow.
        }
    }

    private static boolean isDebugBuild(Context context) {
        return context != null
                && (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private static synchronized boolean ensureLogger(Context context) {
        if (logger != null) {
            return true;
        }
        if (context == null || !isEnabled(context)) {
            return false;
        }

        try {
            Context applicationContext = context.getApplicationContext();
            if (!FacebookSdk.isInitialized()) {
                FacebookSdk.sdkInitialize(applicationContext);
            }
            if (!FacebookSdk.isInitialized()) {
                return false;
            }
            logger = AppEventsLogger.newLogger(applicationContext);
            return true;
        } catch (Exception ignored) {
            if (isDebugBuild(context)) {
                Log.w(TAG, "Meta SDK initialization failed (" + ignored.getClass().getSimpleName() + ")");
            }
            return false;
        }
    }

    private static boolean isEnabled(Context context) {
        try {
            return ENABLED_VALUE.equals(context.getString(R.string.meta_analytics_enabled));
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String mapEventName(String sourceEvent) {
        switch (sourceEvent) {
            case "fd_registration_completed":
                return "fb_mobile_complete_registration";
            case "fd_tutorial_complete":
                return "fb_mobile_tutorial_completion";
            case "fd_card_added":
            case "fd_first_card_added":
                return sourceEvent;
            case "fd_card_learned":
                return "fb_mobile_achievement_unlocked";
            case "fd_game_level_up":
                return "fb_mobile_level_achieved";
            case "fd_screen_view":
                return "fb_mobile_content_view";
            case "fd_subscription_purchase":
                return "fb_mobile_purchase";
            case "fd_subscription_purchase_started":
                return "fb_mobile_initiated_checkout";
            case "fd_login":
                return sourceEvent;
            case "fd_onboarding_completed":
            case "fd_custom_card_added":
            case "fd_tutorial_cards_added":
            case "fd_first_quiz_completed":
            case "fd_first_card_learned":
            case "fd_learn_session_completed":
            case "fd_rank_up":
            case "fd_quiz_completed":
            case "fd_mission_reward_claimed":
            case "fd_points_100_reached":
            case "fd_points_200_reached":
            case "fd_points_500_reached":
            case "fd_points_1000_reached":
            case "fd_ai_practice_message":
            case "fd_ask_completed":
            case "fd_play_review_requested":
            case "fd_play_review_unavailable":
            case "fd_play_review_flow_completed":
                return sourceEvent;
            default:
                return null;
        }
    }

    private static Bundle sanitizeParameters(Bundle sourceParams) {
        Bundle params = new Bundle();
        if (sourceParams == null) {
            return params;
        }

        for (String key : sourceParams.keySet()) {
            if (isDirectIdentifier(key)) {
                continue;
            }

            Object rawValue = sourceParams.get(key);
            if (!(rawValue instanceof String)
                    && !(rawValue instanceof Number)
                    && !(rawValue instanceof Boolean)) {
                continue;
            }

            if (params.size() >= MAX_PARAMETER_COUNT) {
                break;
            }

            String value = String.valueOf(rawValue);
            if (value.length() > MAX_PARAMETER_VALUE_LENGTH) {
                value = value.substring(0, MAX_PARAMETER_VALUE_LENGTH);
            }
            String safeKey = sanitizeParameterName(key);
            if (safeKey != null) {
                params.putString(safeKey, value);
            }
        }

        String cardId = params.getString("card_id");
        if (cardId != null && params.size() < MAX_PARAMETER_COUNT) {
            params.putString("fb_content_id", cardId);
        }
        String termKind = params.getString("term_kind");
        if (termKind != null && params.size() < MAX_PARAMETER_COUNT) {
            params.putString("fb_content_type", termKind);
        }
        String screenName = params.getString("screen_name");
        if (screenName != null && params.size() < MAX_PARAMETER_COUNT) {
            params.putString("fb_content_name", screenName);
        }
        String sku = params.getString("sku");
        if (sku != null && params.size() <= MAX_PARAMETER_COUNT - 2) {
            params.putString("fb_content_id", sku);
            params.putString("fb_content_type", "subscription");
        }

        return params;
    }

    private static boolean isDirectIdentifier(String key) {
        String normalizedKey = key == null ? "" : key.toLowerCase(Locale.ROOT);
        return "user_id".equals(normalizedKey)
                || "email".equals(normalizedKey)
                || "user_email".equals(normalizedKey)
                || "display_name".equals(normalizedKey)
                || "name".equals(normalizedKey)
                || "phone".equals(normalizedKey)
                || "phone_number".equals(normalizedKey)
                || "access_token".equals(normalizedKey)
                || "token".equals(normalizedKey);
    }

    private static String sanitizeParameterName(String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        String sanitized = name.replaceAll("[^a-zA-Z0-9_]", "_");
        if (sanitized.length() > 40) {
            sanitized = sanitized.substring(0, 40);
        }
        if (sanitized.matches("^[0-9].*")) {
            sanitized = "fd_" + sanitized;
        }
        return sanitized.isEmpty() ? null : sanitized;
    }

    private static BigDecimal parsePurchaseValue(String rawValue) {
        if (rawValue == null || rawValue.trim().isEmpty()) {
            return null;
        }
        try {
            BigDecimal value = new BigDecimal(rawValue.trim());
            return value.signum() >= 0 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Currency parseCurrency(String rawCurrency) {
        if (rawCurrency == null || !rawCurrency.matches("[A-Za-z]{3}")) {
            return null;
        }
        try {
            return Currency.getInstance(rawCurrency.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
