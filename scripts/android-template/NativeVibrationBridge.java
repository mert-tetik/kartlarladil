package __PACKAGE__;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONException;

/**
 * Native haptic bridge for the remote WebView.
 *
 * WebView's navigator.vibrate support is inconsistent across Android WebView
 * versions. Keeping the actual vibration in the Android shell makes the
 * behavior independent of the browser implementation.
 */
public final class NativeVibrationBridge {
    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public NativeVibrationBridge(Activity activity) {
        context = activity.getApplicationContext();
    }

    @JavascriptInterface
    public boolean vibrate(String serializedPattern) {
        long[] pattern = parsePattern(serializedPattern);
        if (pattern == null || pattern.length == 0) return false;
        mainHandler.post(() -> play(pattern));
        return true;
    }

    @JavascriptInterface
    public void cancel() {
        mainHandler.post(this::cancelVibration);
    }

    private void play(long[] pattern) {
        Vibrator vibrator = getVibrator();
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrateLegacy(vibrator, pattern);
        }
    }

    private Vibrator getVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager =
                    (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private void cancelVibration() {
        Vibrator vibrator = getVibrator();
        if (vibrator != null) vibrator.cancel();
    }

    @SuppressWarnings("deprecation")
    private static void vibrateLegacy(Vibrator vibrator, long[] pattern) {
        vibrator.vibrate(pattern, -1);
    }

    private static long[] parsePattern(String serializedPattern) {
        if (serializedPattern == null || serializedPattern.length() == 0) return null;
        try {
            JSONArray values = new JSONArray(serializedPattern);
            int length = Math.min(values.length(), 32);
            if (length == 0) return null;
            long[] pattern = new long[length];
            for (int index = 0; index < length; index++) {
                long value = values.optLong(index, 0L);
                pattern[index] = Math.max(0L, Math.min(value, 1000L));
            }
            return pattern;
        } catch (JSONException | RuntimeException ignored) {
            return null;
        }
    }

    public void close() {
        cancel();
        mainHandler.removeCallbacksAndMessages(null);
    }
}
