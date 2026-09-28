/*
 * Copyright 2024 FoxiesDeck
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package __PACKAGE__;

import android.os.Bundle;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;
import com.google.firebase.FirebaseApp;
import com.google.firebase.analytics.FirebaseAnalytics;

public class Application extends android.app.Application {

    @Override
    public void onCreate() {
        super.onCreate();
        FirebaseApp.initializeApp(this);

        try {
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
