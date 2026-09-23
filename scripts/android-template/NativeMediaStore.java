package __PACKAGE__;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import com.google.android.play.core.assetpacks.AssetPackLocation;
import com.google.android.play.core.assetpacks.AssetPackManager;
import com.google.android.play.core.assetpacks.AssetPackManagerFactory;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.atomic.AtomicBoolean;

public final class NativeMediaStore {
    private static final String TAG = "FoxiesDeckMedia";
    private static final String PACK_NAME = "ui_media";
    private static final Pattern RANGE_PATTERN = Pattern.compile("bytes=(\\d*)-(\\d*)");

    private final AssetManager appAssets;
    private final AssetPackManager assetPackManager;
    private final Map<String, MediaAsset> assets = new HashMap<>();
    private final AtomicBoolean loggedFirstOpen = new AtomicBoolean(false);
    private final AtomicBoolean loggedFirstVisualOpen = new AtomicBoolean(false);
    private volatile String packAssetsPath;

    public NativeMediaStore(Context context) {
        appAssets = context.getAssets();
        AssetPackManager manager;
        try {
            manager = AssetPackManagerFactory.getInstance(context);
        } catch (Exception ignored) {
            // Direct APK/debug installs may not have a Play Store asset-pack
            // service. The debug/base APK fallback remains usable in that case.
            manager = null;
        }
        assetPackManager = manager;
        loadIndex();
        refreshPackLocation();
        Log.i(TAG, "Media index loaded: " + assets.size() + " entries; packAssetsPath=" + packAssetsPath);
    }

    public boolean contains(String webPath) {
        return assets.containsKey(webPath);
    }

    public MediaResponse open(String webPath, String rangeHeader) {
        MediaAsset asset = assets.get(webPath);
        if (asset == null) return null;

        try {
            Source source = openSource(asset.relativePath, asset.size);
            if (source == null) return null;
            if (loggedFirstOpen.compareAndSet(false, true)) {
                Log.i(TAG, "Serving bundled media locally: " + webPath + "; packAssetsPath=" + packAssetsPath);
            }
            if ((asset.mimeType.startsWith("image/") || asset.mimeType.startsWith("video/"))
                    && loggedFirstVisualOpen.compareAndSet(false, true)) {
                Log.i(TAG, "Serving bundled visual locally: " + webPath + "; mime=" + asset.mimeType);
            }
            return createResponse(source, asset.mimeType, rangeHeader);
        } catch (IOException ignored) {
            return null;
        }
    }

    private void loadIndex() {
        try (InputStream stream = appAssets.open("ui-media-index.json", AssetManager.ACCESS_STREAMING)) {
            byte[] bytes = readAll(stream);
            JSONObject root = new JSONObject(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            JSONArray entries = root.optJSONArray("assets");
            if (entries == null) return;
            for (int i = 0; i < entries.length(); i++) {
                JSONObject entry = entries.optJSONObject(i);
                if (entry == null) continue;
                String url = entry.optString("url", "");
                String relativePath = entry.optString("relativePath", "");
                String mimeType = entry.optString("mimeType", "application/octet-stream");
                long size = entry.optLong("size", -1L);
                if (url.startsWith("/") && !relativePath.isEmpty()) {
                    assets.put(url, new MediaAsset(relativePath, mimeType, size));
                }
            }
        } catch (Exception ignored) {
            // A missing index must never prevent the remote web app from opening.
        }
    }

    private void refreshPackLocation() {
        if (assetPackManager == null) {
            packAssetsPath = null;
            return;
        }
        try {
            AssetPackLocation location = assetPackManager.getPackLocation(PACK_NAME);
            packAssetsPath = location == null ? null : location.assetsPath();
        } catch (Exception ignored) {
            packAssetsPath = null;
        }
    }

    private Source openSource(String relativePath, long declaredLength) throws IOException {
        String currentPackPath = packAssetsPath;
        if (currentPackPath == null) {
            refreshPackLocation();
            currentPackPath = packAssetsPath;
        }
        if (currentPackPath != null) {
            File file = new File(currentPackPath, relativePath);
            if (file.isFile()) {
                return new Source(new FileInputStream(file), file.length());
            }
        }

        String[] assetCandidates = {"ui-media/" + relativePath, relativePath};
        for (String assetCandidate : assetCandidates) {
            try {
                InputStream stream = appAssets.open(assetCandidate, AssetManager.ACCESS_STREAMING);
                long length = declaredLength >= 0 ? declaredLength : stream.available();
                return new Source(stream, length);
            } catch (FileNotFoundException ignored) {
                // Debug builds use the ui-media/ prefix; installed asset-pack
                // splits may expose their files directly at the asset root.
            }
        }
        return null;
    }

    private static MediaResponse createResponse(Source source, String mimeType, String rangeHeader) throws IOException {
        long totalLength = source.length;
        if (totalLength < 0 || rangeHeader == null || rangeHeader.isEmpty()) {
            return new MediaResponse(mimeType, source.stream, totalLength, false, 0, Math.max(0, totalLength - 1), totalLength);
        }

        try {
            Matcher matcher = RANGE_PATTERN.matcher(rangeHeader.trim());
            if (!matcher.matches()) {
                return new MediaResponse(mimeType, source.stream, totalLength, false, 0, Math.max(0, totalLength - 1), totalLength);
            }

            String startText = matcher.group(1);
            String endText = matcher.group(2);
            long start;
            long end;
            if (startText == null || startText.isEmpty()) {
                if (endText == null || endText.isEmpty()) throw new NumberFormatException();
                long suffixLength = Long.parseLong(endText);
                start = Math.max(0, totalLength - suffixLength);
                end = totalLength - 1;
            } else {
                start = Long.parseLong(startText);
                end = endText == null || endText.isEmpty() ? totalLength - 1 : Long.parseLong(endText);
                end = Math.min(end, totalLength - 1);
            }

            if (start < 0 || start >= totalLength || end < start) {
                source.stream.close();
                return null;
            }

            skipFully(source.stream, start);
            long length = end - start + 1;
            return new MediaResponse(
                    mimeType,
                    new LimitedInputStream(source.stream, length),
                    length,
                    true,
                    start,
                    end,
                    totalLength
            );
        } catch (NumberFormatException ignored) {
            source.stream.close();
            return null;
        }
    }

    private static void skipFully(InputStream stream, long bytes) throws IOException {
        long remaining = bytes;
        while (remaining > 0) {
            long skipped = stream.skip(remaining);
            if (skipped > 0) {
                remaining -= skipped;
                continue;
            }
            if (stream.read() == -1) throw new IOException("Unable to seek media stream");
            remaining -= 1;
        }
    }

    private static byte[] readAll(InputStream stream) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = stream.read(buffer)) != -1) output.write(buffer, 0, read);
        return output.toByteArray();
    }

    private static final class Source {
        final InputStream stream;
        final long length;

        Source(InputStream stream, long length) {
            this.stream = stream;
            this.length = length;
        }
    }

    private static final class MediaAsset {
        final String relativePath;
        final String mimeType;
        final long size;

        MediaAsset(String relativePath, String mimeType, long size) {
            this.relativePath = relativePath;
            this.mimeType = mimeType;
            this.size = size;
        }
    }

    public static final class MediaResponse {
        public final String mimeType;
        public final InputStream stream;
        public final long length;
        public final boolean partial;
        public final long start;
        public final long end;
        public final long totalLength;

        MediaResponse(String mimeType, InputStream stream, long length, boolean partial, long start, long end, long totalLength) {
            this.mimeType = mimeType;
            this.stream = stream;
            this.length = length;
            this.partial = partial;
            this.start = start;
            this.end = end;
            this.totalLength = totalLength;
        }
    }

    private static final class LimitedInputStream extends InputStream {
        private final InputStream delegate;
        private long remaining;

        LimitedInputStream(InputStream delegate, long remaining) {
            this.delegate = delegate;
            this.remaining = remaining;
        }

        @Override public int read() throws IOException {
            if (remaining <= 0) return -1;
            int value = delegate.read();
            if (value >= 0) remaining -= 1;
            return value;
        }

        @Override public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining <= 0) return -1;
            int requested = (int) Math.min(length, remaining);
            int read = delegate.read(buffer, offset, requested);
            if (read > 0) remaining -= read;
            return read;
        }

        @Override public void close() throws IOException { delegate.close(); }
    }
}
