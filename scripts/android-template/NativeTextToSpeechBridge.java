package __PACKAGE__;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;

import java.util.Locale;

/** Exposes Android's installed, offline-capable TextToSpeech engine to the WebView. */
public final class NativeTextToSpeechBridge implements TextToSpeech.OnInitListener {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final TextToSpeech textToSpeech;
    private volatile boolean ready;
    private volatile boolean initializationComplete;
    private String pendingText;
    private String pendingLanguageTag;
    private float pendingRate;

    public NativeTextToSpeechBridge(Activity activity) {
        textToSpeech = new TextToSpeech(activity.getApplicationContext(), this);
    }

    @Override
    public void onInit(int status) {
        mainHandler.post(() -> {
            initializationComplete = true;
            ready = status == TextToSpeech.SUCCESS;
            if (ready && pendingText != null) {
                String text = pendingText;
                String languageTag = pendingLanguageTag;
                float rate = pendingRate;
                pendingText = null;
                pendingLanguageTag = null;
                speakNow(text, languageTag, rate);
            } else {
                pendingText = null;
                pendingLanguageTag = null;
            }
        });
    }

    @JavascriptInterface
    public boolean speak(String text, String languageTag, double rate) {
        return enqueueSpeech(text, languageTag, rate);
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
        return enqueueSpeech(text, languageTag, rate);
    }

    private boolean enqueueSpeech(String text, String languageTag, double rate) {
        if (text == null || text.trim().isEmpty()) return false;
        if (initializationComplete && !ready) return false;

        String normalizedText = text.trim();
        String normalizedLanguage = languageTag == null ? "en-US" : languageTag.trim();
        float normalizedRate = (float) Math.max(0.5, Math.min(2.0, rate));
        mainHandler.post(() -> {
            if (ready) {
                speakNow(normalizedText, normalizedLanguage, normalizedRate);
            } else {
                pendingText = normalizedText;
                pendingLanguageTag = normalizedLanguage;
                pendingRate = normalizedRate;
            }
        });
        return true;
    }

    @JavascriptInterface
    public void stop() {
        mainHandler.post(() -> {
            pendingText = null;
            pendingLanguageTag = null;
            if (ready) textToSpeech.stop();
        });
    }

    private void speakNow(String text, String languageTag, float rate) {
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
            return;
        }

        textToSpeech.setSpeechRate(rate);
        int speechStatus = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "foxiesdeck-speech");
        if (speechStatus != TextToSpeech.SUCCESS) {
            // Reset the language once before giving up. This handles engines
            // that briefly reject a queue immediately after a language change.
            try {
                textToSpeech.setLanguage(selectedLocale);
                textToSpeech.setSpeechRate(rate);
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "foxiesdeck-speech-fallback");
            } catch (RuntimeException ignored) {
                // The device's TTS engine remains optional for the WebView.
            }
        }
    }

    public void close() {
        mainHandler.post(() -> {
            pendingText = null;
            pendingLanguageTag = null;
            ready = false;
            initializationComplete = true;
            textToSpeech.stop();
            textToSpeech.shutdown();
        });
    }
}
