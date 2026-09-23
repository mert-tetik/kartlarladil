package __PACKAGE__;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class LocalMediaWebViewClient extends WebViewClient {
    private final Activity activity;
    private final NativeMediaStore mediaStore;

    public LocalMediaWebViewClient(Activity activity, NativeMediaStore mediaStore) {
        this.activity = activity;
        this.mediaStore = mediaStore;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return handleNavigation(request.getUrl());
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return handleNavigation(Uri.parse(url));
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return intercept(request.getUrl(), request.getRequestHeaders());
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
        return intercept(Uri.parse(url), null);
    }

    private WebResourceResponse intercept(Uri uri, Map<String, String> requestHeaders) {
        if (uri == null || !isAppHost(uri.getHost())) {
            return null;
        }

        String localPath = resolveLocalPath(uri);
        if (localPath == null || !mediaStore.contains(localPath)) {
            return null;
        }

        String range = getHeader(requestHeaders, "Range");
        NativeMediaStore.MediaResponse response = mediaStore.open(localPath, range);
        if (response == null) {
            return null;
        }

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Cache-Control", "public, max-age=31536000, immutable");
        headers.put("Accept-Ranges", "bytes");
        if (response.length >= 0) {
            headers.put("Content-Length", String.valueOf(response.length));
        }
        if (response.partial) {
            headers.put(
                    "Content-Range",
                    "bytes " + response.start + "-" + response.end + "/" + response.totalLength
            );
        }

        InputStream data = response.stream;
        return new WebResourceResponse(
                response.mimeType,
                "",
                response.partial ? 206 : 200,
                response.partial ? "Partial Content" : "OK",
                headers,
                data
        );
    }

    private boolean handleNavigation(Uri uri) {
        if (isInternalEventUrl(uri)) {
            try {
                Intent eventIntent = new Intent(activity, EventReceiverActivity.class);
                eventIntent.setData(uri);
                activity.startActivity(eventIntent);
            } catch (Exception ignored) {
                // Analytics/review events are best-effort and must not block navigation.
            }
            return true;
        }

        if (uri != null && isAppHost(uri.getHost())) {
            return maybeOpenGoogleAuth(uri);
        }

        // Keep the native JavaScript bridge scoped to the trusted FoxiesDeck
        // document. External pages must never be rendered in this WebView.
        return openExternalUrl(uri);
    }

    private static boolean isInternalEventUrl(Uri uri) {
        return uri != null
                && "foxiesdeck".equalsIgnoreCase(uri.getScheme())
                && "event".equalsIgnoreCase(uri.getHost());
    }

    private boolean maybeOpenGoogleAuth(Uri uri) {
        if (uri == null || !isGoogleAuthUrl(uri)) return false;
        return openExternalUrl(uri);
    }

    private boolean openExternalUrl(Uri uri) {
        if (uri == null) return true;
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (Exception ignored) {
            // Do not fall back to rendering an untrusted URL in the WebView.
            return true;
        }
    }

    private static boolean isGoogleAuthUrl(Uri uri) {
        String host = uri.getHost();
        if (host == null) return false;
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        if ("accounts.google.com".equals(normalizedHost)
                || normalizedHost.endsWith(".google.com")) {
            return true;
        }
        return normalizedHost.endsWith(".supabase.co")
                && uri.getPath() != null
                && uri.getPath().startsWith("/auth/v1/authorize");
    }

    private static String resolveLocalPath(Uri uri) {
        String path = uri.getPath();
        if ("/_next/image".equals(path)) {
            String source = uri.getQueryParameter("url");
            if (source == null || source.isEmpty()) {
                return null;
            }
            Uri sourceUri = Uri.parse(source);
            if (sourceUri.getScheme() != null && !isAppHost(sourceUri.getHost())) {
                return null;
            }
            path = sourceUri.getPath();
        }
        if (path == null || !path.startsWith("/") || path.contains("..")) {
            return null;
        }
        return path;
    }

    private static boolean isAppHost(String host) {
        return "www.foxiesdeck.com".equalsIgnoreCase(host)
                || "foxiesdeck.com".equalsIgnoreCase(host);
    }

    private static String getHeader(Map<String, String> headers, String name) {
        if (headers == null) return null;
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (name.equalsIgnoreCase(entry.getKey())) return entry.getValue();
        }
        return null;
    }
}
