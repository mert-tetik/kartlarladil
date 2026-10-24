/*
 * Copyright 2024 FoxiesDeck
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package __PACKAGE__;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;
import com.google.firebase.FirebaseApp;
import com.google.firebase.analytics.FirebaseAnalytics;

public class Application extends android.app.Application {

    @Override
    public void onCreate() {
        super.onCreate();
        // Firebase is ancillary to the first frame. Defer its setup until the
        // Activity launch message has returned so analytics cannot extend the
        // native launch window or delay the WebView splash.
        new Handler(Looper.getMainLooper()).post(this::initializeAnalytics);
    }

    private void initializeAnalytics() {
        try {
            FirebaseApp.initializeApp(this);
            FirebaseAnalytics analytics = FirebaseAnalytics.getInstance(this);
            ProcessLifecycleOwner.get().getLifecycle().addObserver(new DefaultLifecycleObserver() {
                @Override
                public void onStart(LifecycleOwner owner) {
                    analytics.logEvent(FirebaseAnalytics.Event.APP_OPEN, new Bundle());
                }
            });
        } catch (Exception e) {
            // Ignore analytics initialization failures so the app does not crash on startup.
        }
    }
}
