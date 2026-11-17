/*
 * Copyright 2024 FoxiesDeck
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package __PACKAGE__;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.analytics.FirebaseAnalytics;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Handles WebView analytics events without opening a foreground Activity. */
public final class NativeAnalyticsReceiver extends BroadcastReceiver {
    private static final String TAG = "FoxiesDeckMeta";
    private static final ExecutorService ANALYTICS_EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null
                || !"foxiesdeck".equals(data.getScheme())
                || !"event".equals(data.getHost())) {
            return;
        }

        String eventType = data.getQueryParameter("type");
        if (eventType == null || eventType.isEmpty() || "request_play_review".equals(eventType)) {
            return;
        }

        if ((context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.i(TAG, "Native analytics event received: " + eventType);
        }

        PendingResult pendingResult = goAsync();
        Context appContext = context.getApplicationContext();
        try {
            ANALYTICS_EXECUTOR.execute(() -> {
                try {
                    logEvent(appContext, data, eventType);
                } finally {
                    pendingResult.finish();
                }
            });
        } catch (RuntimeException exception) {
            pendingResult.finish();
        }
    }

    private static void logEvent(Context context, Uri data, String eventType) {
        if ("set_user_id".equals(eventType)) {
            try {
                getFirebaseAnalytics(context).setUserId(data.getQueryParameter("user_id"));
            } catch (Exception ignored) {
                logFirebaseFailure(context, eventType, ignored);
                // Firebase is best-effort and must not block the event bridge.
            }
            return;
        }

        Bundle params = new Bundle();
        for (String key : data.getQueryParameterNames()) {
            if ("type".equals(key)) continue;
            String value = data.getQueryParameter(key);
            if (value != null) params.putString(key, value);
        }

        try {
            String firebaseEventName = sanitizeEventName(eventType);
            getFirebaseAnalytics(context).logEvent(firebaseEventName, params);
            if (isDebugBuild(context)) {
                Log.i(TAG, "Firebase event queued: " + firebaseEventName);
            }
        } catch (Exception ignored) {
            logFirebaseFailure(context, eventType, ignored);
            // Firebase is best-effort and must not block Meta App Events.
        }

        NativeMetaAnalytics.logEvent(context, eventType, params);
    }

    private static FirebaseAnalytics getFirebaseAnalytics(Context context) {
        if (FirebaseApp.getApps(context).isEmpty()) {
            FirebaseApp.initializeApp(context);
        }
        return FirebaseAnalytics.getInstance(context);
    }

    private static void logFirebaseFailure(Context context, String eventType, Exception exception) {
        if (isDebugBuild(context)) {
            Log.w(TAG, "Firebase event failed: " + eventType + " ("
                    + exception.getClass().getSimpleName() + ")");
        }
    }

    private static boolean isDebugBuild(Context context) {
        return context != null
                && (context.getApplicationInfo().flags
                & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private static String sanitizeEventName(String name) {
        String sanitized = name.replaceAll("[^a-zA-Z0-9_]", "_");
        if (sanitized.length() > 40) sanitized = sanitized.substring(0, 40);
        if (sanitized.matches("^[0-9].*")) sanitized = "fd_" + sanitized;
        return sanitized.isEmpty() ? "fd_unknown_event" : sanitized;
    }
}
