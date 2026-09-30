package __PACKAGE__;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;

import java.util.Locale;
import java.util.Set;

/** Exposes Android's installed, offline-capable TextToSpeech engine to the WebView. */
public final class NativeTextToSpeechBridge implements TextToSpeech.OnInitListener {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final TextToSpeech textToSpeech;
    private boolean ready;
    private String pendingText;
    private String pendingLanguageTag;
    private float pendingRate;
    private String pendingVoiceGender;
    private String pendingVoiceAge;

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
                String voiceGender = pendingVoiceGender;
                String voiceAge = pendingVoiceAge;
                pendingText = null;
                pendingLanguageTag = null;
                pendingVoiceGender = null;
                pendingVoiceAge = null;
                speakNow(text, languageTag, rate, voiceGender, voiceAge);
            }
        });
    }

    @JavascriptInterface
    public boolean speak(String text, String languageTag, double rate) {
        return enqueueSpeech(text, languageTag, rate, null, null);
    }

    /**
     * Compatibility entry point for the web app's character voice metadata.
     * Selects a matching installed Android TTS voice when the engine exposes
     * gender/age hints in its voice metadata. Engines without such metadata
     * safely fall back to the best voice for the requested language.
     */
    @JavascriptInterface
    public boolean speakWithProfile(
            String text,
            String languageTag,
            double rate,
            String voiceGender,
            String voiceAge
    ) {
        return enqueueSpeech(text, languageTag, rate, voiceGender, voiceAge);
    }

    private boolean enqueueSpeech(String text, String languageTag, double rate, String voiceGender, String voiceAge) {
        if (text == null || text.trim().isEmpty()) return false;

        String normalizedText = text.trim();
        String normalizedLanguage = languageTag == null ? "en-US" : languageTag.trim();
        float normalizedRate = (float) Math.max(0.5, Math.min(2.0, rate));
        mainHandler.post(() -> {
            if (ready) {
                speakNow(normalizedText, normalizedLanguage, normalizedRate, voiceGender, voiceAge);
            } else {
                pendingText = normalizedText;
                pendingLanguageTag = normalizedLanguage;
                pendingRate = normalizedRate;
                pendingVoiceGender = voiceGender;
                pendingVoiceAge = voiceAge;
            }
        });
        return true;
    }

    @JavascriptInterface
    public void stop() {
        mainHandler.post(() -> {
            pendingText = null;
            pendingLanguageTag = null;
            pendingVoiceGender = null;
            pendingVoiceAge = null;
            if (ready) textToSpeech.stop();
        });
    }

    private void speakNow(String text, String languageTag, float rate) {
        speakNow(text, languageTag, rate, null, null);
    }

    private void speakNow(String text, String languageTag, float rate, String gender, String age) {
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

        Voice profileVoice = findProfileVoice(locale, gender, age);
        if (profileVoice != null) textToSpeech.setVoice(profileVoice);

        textToSpeech.setSpeechRate(rate);
        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "foxiesdeck-speech");
    }

    private Voice findProfileVoice(Locale locale, String gender, String age) {
        if (gender == null && age == null) return null;
        Set<Voice> voices = textToSpeech.getVoices();
        if (voices == null) return null;

        Voice languageFallback = null;
        for (Voice voice : voices) {
            if (voice == null || voice.getLocale() == null
                    || !voice.getLocale().getLanguage().equals(locale.getLanguage())) continue;
            if (languageFallback == null) languageFallback = voice;

            String label = (voice.getName() + " " + voice.getFeatures()).toLowerCase(Locale.ROOT);
            boolean genderMatches = gender == null
                    || ("female".equalsIgnoreCase(gender) && containsAny(label, "female", "woman", "zira", "samantha", "susan", "karen", "hazel", "sara", "ava", "jenny", "aria", "libby", "salli", "joanna", "emma", "olivia"))
                    || ("male".equalsIgnoreCase(gender) && containsAny(label, "male", "man", "david", "mark", "guy", "daniel", "alex", "george", "james", "thomas", "arthur", "frank", "leo"));
            boolean ageMatches = age == null
                    || ("young".equalsIgnoreCase(age) && containsAny(label, "young", "teen", "child", "kid", "junior", "youth"))
                    || ("elder".equalsIgnoreCase(age) && containsAny(label, "elder", "senior", "grandma", "grandpa", "old"))
                    || "adult".equalsIgnoreCase(age);
            if (genderMatches && ageMatches) return voice;
        }
        return languageFallback;
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) return true;
        }
        return false;
    }

    public void close() {
        mainHandler.post(() -> {
            pendingText = null;
            pendingLanguageTag = null;
            pendingVoiceGender = null;
            pendingVoiceAge = null;
            ready = false;
            textToSpeech.stop();
            textToSpeech.shutdown();
        });
    }
}
