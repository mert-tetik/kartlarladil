/*
 * Copyright 2024 FoxiesDeck
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package __PACKAGE__;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

import java.util.concurrent.atomic.AtomicBoolean;

/** Receives trusted native actions from the remote web app. */
public class EventReceiverActivity extends Activity {
    private static final long FINISH_DELAY_MS = 500L;
    private static final AtomicBoolean REVIEW_IN_FLIGHT = new AtomicBoolean(false);
    private final Handler finishHandler = new Handler(Looper.getMainLooper());
    private final Runnable finishRunnable = this::finish;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!handleIntent(getIntent())) {
            scheduleFinish();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!handleIntent(intent)) {
            scheduleFinish();
        }
    }

    private void scheduleFinish() {
        if (REVIEW_IN_FLIGHT.get()) return;
        finishHandler.removeCallbacks(finishRunnable);
        finishHandler.postDelayed(finishRunnable, FINISH_DELAY_MS);
    }

    private boolean handleIntent(Intent intent) {
        if (intent == null) return false;
        Uri data = intent.getData();
        if (data == null
                || !"foxiesdeck".equals(data.getScheme())
                || !"event".equals(data.getHost())) {
            return false;
        }

        String eventType = data.getQueryParameter("type");
        if (eventType == null || eventType.isEmpty()) return false;

        if ("request_play_review".equals(eventType)) {
            requestPlayReview();
            return true;
        }
        return false;
    }

    private void requestPlayReview() {
        finishHandler.removeCallbacks(finishRunnable);
        if (!REVIEW_IN_FLIGHT.compareAndSet(false, true)) return;

        ReviewManager reviewManager = ReviewManagerFactory.create(this);
        reviewManager.requestReviewFlow().addOnCompleteListener(request -> {
            if (!request.isSuccessful()) {
                finishPlayReviewRequest();
                return;
            }
            ReviewInfo reviewInfo = request.getResult();
            reviewManager.launchReviewFlow(this, reviewInfo).addOnCompleteListener(result -> {
                finishPlayReviewRequest();
            });
        });
    }

    private void finishPlayReviewRequest() {
        REVIEW_IN_FLIGHT.set(false);
        finishHandler.removeCallbacks(finishRunnable);
        finish();
    }

}
