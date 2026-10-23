package __PACKAGE__;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.Locale;

/** Exposes Android's installed, offline-capable TextToSpeech engine to the WebView. */
public final class NativeTextToSpeechBridge implements TextToSpeech.OnInitListener {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final TextToSpeech textToSpeech;
    private final WebView webView;
    private volatile boolean ready;
    private volatile boolean initializationComplete;
    private volatile boolean closed;
    private String pendingText;
    private String pendingLanguageTag;
    private String pendingRequestId;
    private float pendingRate;

    public NativeTextToSpeechBridge(Activity activity, WebView webView) {
        this.webView = webView;
        textToSpeech = new TextToSpeech(activity.getApplicationContext(), this);
        textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                dispatchSpeechStatus(utteranceId, "start");
            }

            @Override
            public void onDone(String utteranceId) {
                dispatchSpeechStatus(utteranceId, "end");
            }

            @Override
            public void onError(String utteranceId) {
                dispatchSpeechStatus(utteranceId, "end");
            }

            @Override
            public void onStop(String utteranceId, boolean interrupted) {
                dispatchSpeechStatus(utteranceId, "end");
            }
        });
    }

    @Override
    public void onInit(int status) {
        mainHandler.post(() -> {
            initializationComplete = true;
            ready = status == TextToSpeech.SUCCESS;
            if (ready && pendingText != null) {
                String text = pendingText;
                String languageTag = pendingLanguageTag;
                String requestId = pendingRequestId;
                float rate = pendingRate;
                pendingText = null;
                pendingLanguageTag = null;
                pendingRequestId = null;
                speakNow(text, languageTag, rate, requestId);
            } else {
                String requestId = pendingRequestId;
                pendingText = null;
                pendingLanguageTag = null;
                pendingRequestId = null;
                if (requestId != null) dispatchSpeechStatus(requestId, "end");
            }
        });
    }

    @JavascriptInterface
    public boolean speak(String text, String languageTag, double rate) {
        return enqueueSpeech(text, languageTag, rate, null);
    }

    @JavascriptInterface
    public boolean speakWithLifecycle(String text, String languageTag, double rate, String requestId) {
        return enqueueSpeech(text, languageTag, rate, requestId);
    }

    /** Compatibility entry point retained for older WebView bundles. */
    @JavascriptInterface
    public boolean speakWithProfile(
            String text,
            String languageTag,
            double rate,
            String voiceGender,
            String voiceAge
    ) {
        // Keep this method for older WebView bundles, but deliberately ignore
        // profile hints. Android TTS engines disagree on gender/age metadata;
        // selecting a matching-looking voice can make speech fail silently.
        return enqueueSpeech(text, languageTag, rate, null);
    }

    private boolean enqueueSpeech(String text, String languageTag, double rate, String requestId) {
        if (text == null || text.trim().isEmpty()) return false;
        if (initializationComplete && !ready) return false;

        String normalizedText = text.trim();
        String normalizedLanguage = languageTag == null ? "en-US" : languageTag.trim();
        String normalizedRequestId = requestId == null || requestId.trim().isEmpty()
                ? "legacy-" + System.nanoTime()
                : requestId.trim();
        float normalizedRate = (float) Math.max(0.5, Math.min(2.0, rate));
        mainHandler.post(() -> {
            if (ready) {
                speakNow(normalizedText, normalizedLanguage, normalizedRate, normalizedRequestId);
            } else {
                if (pendingRequestId != null) dispatchSpeechStatus(pendingRequestId, "end");
                pendingText = normalizedText;
                pendingLanguageTag = normalizedLanguage;
                pendingRequestId = normalizedRequestId;
                pendingRate = normalizedRate;
            }
        });
        return true;
    }

    @JavascriptInterface
    public void stop() {
        mainHandler.post(() -> {
            String cancelledRequestId = pendingRequestId;
            pendingText = null;
            pendingLanguageTag = null;
            pendingRequestId = null;
            if (cancelledRequestId != null) dispatchSpeechStatus(cancelledRequestId, "end");
            if (ready) textToSpeech.stop();
        });
    }

    private void speakNow(String text, String languageTag, float rate, String requestId) {
        Locale locale = Locale.forLanguageTag(languageTag);
        if (locale.getLanguage().isEmpty()) locale = Locale.US;

        Locale selectedLocale = locale;
        int languageStatus = textToSpeech.setLanguage(selectedLocale);
        if (languageStatus == TextToSpeech.LANG_MISSING_DATA
                || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
            selectedLocale = new Locale(locale.getLanguage());
            languageStatus = textToSpeech.setLanguage(selectedLocale);
        }
        if (languageStatus == TextToSpeech.LANG_MISSING_DATA
                || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
            // Do not silently switch to an unrelated language. If the exact
            // regional voice is missing, the base language is the only safe
            // fallback; otherwise the request should simply be skipped.
            dispatchSpeechStatus(requestId, "end");
            return;
        }

        textToSpeech.setSpeechRate(rate);
        int speechStatus = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, requestId);
        if (speechStatus != TextToSpeech.SUCCESS) {
            // Reset the language once before giving up. This handles engines
            // that briefly reject a queue immediately after a language change.
            try {
                textToSpeech.setLanguage(selectedLocale);
                textToSpeech.setSpeechRate(rate);
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, requestId);
            } catch (RuntimeException ignored) {
                // The device's TTS engine remains optional for the WebView.
            }
        }
    }

    private void dispatchSpeechStatus(String requestId, String state) {
        if (closed || webView == null || requestId == null) return;
        String script = "if (typeof window.FoxiesDeckNativeSpeechStatus === 'function') {"
                + "window.FoxiesDeckNativeSpeechStatus(" + JSONObject.quote(requestId) + ","
                + JSONObject.quote(state) + ");}";
        webView.post(() -> {
            if (closed) return;
            try {
                webView.evaluateJavascript(script, null);
            } catch (RuntimeException ignored) {
                // Speech completion is only a UI hint; stale WebViews can safely ignore it.
            }
        });
    }

    public void close() {
        closed = true;
        mainHandler.post(() -> {
            pendingText = null;
            pendingLanguageTag = null;
            pendingRequestId = null;
            ready = false;
            initializationComplete = true;
            textToSpeech.stop();
            textToSpeech.shutdown();
        });
    }
}
