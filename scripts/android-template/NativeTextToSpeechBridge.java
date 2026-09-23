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
    private boolean ready;
    private String pendingText;
    private String pendingLanguageTag;
    private float pendingRate;

    public NativeTextToSpeechBridge(Activity activity) {
        textToSpeech = new TextToSpeech(activity.getApplicationContext(), this);
    }

    @Override
    public void onInit(int status) {
        mainHandler.post(() -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready && pendingText != null) {
                String text = pendingText;
                String languageTag = pendingLanguageTag;
                float rate = pendingRate;
                pendingText = null;
                pendingLanguageTag = null;
                speakNow(text, languageTag, rate);
            }
        });
    }

    @JavascriptInterface
    public boolean speak(String text, String languageTag, double rate) {
        if (text == null || text.trim().isEmpty()) return false;

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

        int languageStatus = textToSpeech.setLanguage(locale);
        if (languageStatus == TextToSpeech.LANG_MISSING_DATA
                || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
            Locale fallback = new Locale(locale.getLanguage());
            languageStatus = textToSpeech.setLanguage(fallback);
        }
        if (languageStatus == TextToSpeech.LANG_MISSING_DATA
                || languageStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
            return;
        }

        textToSpeech.setSpeechRate(rate);
        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "foxiesdeck-speech");
    }

    public void close() {
        mainHandler.post(() -> {
            pendingText = null;
            pendingLanguageTag = null;
            ready = false;
            textToSpeech.stop();
            textToSpeech.shutdown();
        });
    }
}
