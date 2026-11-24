package __PACKAGE__;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebResourceError;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ServiceWorkerClient;

import org.json.JSONObject;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

public final class LocalMediaWebViewClient extends WebViewClient {
    private static final String TAG = "FoxiesDeckMedia";
    private static final boolean LOCAL_MEDIA_FALLBACK_DEBUG_MODE_ENABLED = true;
    private static final String LOCAL_MEDIA_LOCAL_HIT_EVENT = "foxiesdeck:native-media-local-hit";
    private static final String LOCAL_MEDIA_LOCAL_MISS_EVENT = "foxiesdeck:native-media-local-miss";
    private final Activity activity;
    private final NativeMediaStore mediaStore;
    private final Runnable onPageCommitVisible;
    private final Set<String> loggedRemoteFallbacks = Collections.synchronizedSet(new HashSet<>());
    private final AtomicBoolean loggedFirstChestFrameHit = new AtomicBoolean(false);
    private final AtomicBoolean loggedFirstChestFrameMiss = new AtomicBoolean(false);
    private volatile WebView webView;

    public LocalMediaWebViewClient(
            Activity activity,
            NativeMediaStore mediaStore,
            Runnable onPageCommitVisible
    ) {
        this.activity = activity;
        this.mediaStore = mediaStore;
        this.onPageCommitVisible = onPageCommitVisible;
    }

    public void attachWebView(WebView view) {
        webView = view;
    }

    public ServiceWorkerClient createServiceWorkerClient() {
        return new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                WebView currentWebView = LocalMediaWebViewClient.this.webView;
                return intercept(
                        currentWebView,
                        request.getUrl(),
                        request.getRequestHeaders()
                );
            }
        };
    }

    @Override
    public void onPageCommitVisible(WebView view, String url) {
        super.onPageCommitVisible(view, url);
        if (onPageCommitVisible != null) {
            view.post(onPageCommitVisible);
        }
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
        return intercept(view, request.getUrl(), request.getRequestHeaders());
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
        return intercept(view, Uri.parse(url), null);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        Uri failedUrl = request == null ? null : request.getUrl();
        if (request != null
                && request.isForMainFrame()
                && failedUrl != null
                && isAppHost(failedUrl.getHost())
                && !isOfflineShellPath(failedUrl.getPath())
                && error != null
                && isConnectivityError(error.getErrorCode())) {
            Uri offlineUrl = new Uri.Builder()
                    .scheme("https")
                    .authority("www.foxiesdeck.com")
                    .path("/~offline")
                    .appendQueryParameter("returnTo", failedUrl.toString())
                    .build();
            view.post(() -> view.loadUrl(offlineUrl.toString()));
            return;
        }
        super.onReceivedError(view, request, error);
    }

    private WebResourceResponse intercept(WebView view, Uri uri, Map<String, String> requestHeaders) {
        if (uri == null || !isAppHost(uri.getHost())) {
            return null;
        }

        WebResourceResponse offlineResponse = openOfflineShellAsset(uri.getPath());
        if (offlineResponse != null) {
            return offlineResponse;
        }

        String localPath = resolveLocalPath(uri);
        if (localPath == null) {
            return null;
        }

        // A media element uses this one-shot query parameter after a local
        // asset fails. Returning null deliberately lets WebView fetch the same
        // URL remotely; in debug mode, surface the local lookup path as well.
        if (uri.getQueryParameter("native-media-fallback") != null) {
            logRemoteFallback(view, localPath, "explicit remote media fallback");
            return null;
        }

        // Returning null deliberately hands the request back to WebView. That
        // is the only remote fallback path: a bundled/indexed asset never
        // reaches the network because open() returns a WebResourceResponse.
        if (!mediaStore.contains(localPath)) {
            logRemoteFallback(view, localPath, "not in bundled media index");
            return null;
        }

        String range = getHeader(requestHeaders, "Range");
        NativeMediaStore.MediaResponse response = mediaStore.open(localPath, range);
        if (response == null) {
            // The index can outlive a damaged/incomplete install. Falling
            // through keeps the old app usable by loading the same URL from
            // the website instead of showing a broken media element.
            logRemoteFallback(view, localPath, "bundled asset is not readable");
            return null;
        }

        if (LOCAL_MEDIA_FALLBACK_DEBUG_MODE_ENABLED
                && localPath.startsWith("/chests/opening-frames/")
                && loggedFirstChestFrameHit.compareAndSet(false, true)) {
            Log.i(TAG, "Serving bundled chest frame locally: " + localPath);
            notifyLocalMediaHit(view, localPath);
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

    private WebResourceResponse openOfflineShellAsset(String path) {
        if (path == null) return null;

        String assetPath;
        if ("/~offline".equals(path) || "/~offline/".equals(path)) {
            assetPath = "foxiesdeck-offline/index.html";
        } else if (path.startsWith("/offline-shell/")) {
            String relativePath = path.substring("/offline-shell/".length());
            if (relativePath.isEmpty() || relativePath.contains("..") || relativePath.contains("\\")) {
                return null;
            }
            assetPath = "foxiesdeck-offline/" + relativePath;
        } else {
            return null;
        }

        try {
            InputStream input = activity.getAssets().open(assetPath);
            String mimeType;
            String encoding = null;
            if (assetPath.endsWith(".html")) {
                mimeType = "text/html";
                encoding = "utf-8";
            } else if (assetPath.endsWith(".js")) {
                mimeType = "application/javascript";
                encoding = "utf-8";
            } else if (assetPath.endsWith(".css")) {
                mimeType = "text/css";
                encoding = "utf-8";
            } else if (assetPath.endsWith(".webp")) {
                mimeType = "image/webp";
            } else if (assetPath.endsWith(".ttf")) {
                mimeType = "font/ttf";
            } else {
                mimeType = "application/octet-stream";
            }
            Map<String, String> headers = new LinkedHashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, input);
        } catch (java.io.IOException missingAsset) {
            Log.e(TAG, "Bundled offline shell asset missing: " + assetPath, missingAsset);
            return null;
        }
    }

    private static boolean isOfflineShellPath(String path) {
        return "/~offline".equals(path)
                || "/~offline/".equals(path)
                || (path != null && path.startsWith("/offline-shell/"));
    }

    private static boolean isConnectivityError(int errorCode) {
        return errorCode == ERROR_UNKNOWN
                || errorCode == ERROR_HOST_LOOKUP
                || errorCode == ERROR_CONNECT
                || errorCode == ERROR_TIMEOUT
                || errorCode == ERROR_IO;
    }

    private void logRemoteFallback(WebView view, String localPath, String reason) {
        if (!isMediaPath(localPath)) {
            return;
        }

        if (loggedRemoteFallbacks.add(localPath)) {
            if (localPath.startsWith("/chests/opening-frames/")
                    && !loggedFirstChestFrameMiss.compareAndSet(false, true)) {
                return;
            }
            Log.i(TAG, "Remote media fallback: " + localPath + " (" + reason + ")");
            if (LOCAL_MEDIA_FALLBACK_DEBUG_MODE_ENABLED && isVisualMediaPath(localPath)) {
                notifyLocalMediaMiss(view, localPath);
            }
        }
    }

    private void notifyLocalMediaMiss(WebView view, String localPath) {
        notifyMediaPathEvent(view, LOCAL_MEDIA_LOCAL_MISS_EVENT, localPath);
    }

    private void notifyLocalMediaHit(WebView view, String localPath) {
        notifyMediaPathEvent(view, LOCAL_MEDIA_LOCAL_HIT_EVENT, localPath);
    }

    private void notifyMediaPathEvent(WebView view, String eventName, String localPath) {
        if (view == null) return;

        String quotedEventName = JSONObject.quote(eventName);
        String quotedLocalPath = JSONObject.quote(localPath);
        String script = "window.__foxiesDeckNativeMediaDiagnostics = window.__foxiesDeckNativeMediaDiagnostics || {};"
                + "window.__foxiesDeckNativeMediaDiagnostics["
                + quotedEventName
                + "]="
                + quotedLocalPath
                + ";window.dispatchEvent(new CustomEvent("
                + quotedEventName
                + ",{detail:{path:"
                + quotedLocalPath
                + "}}));";
        view.post(() -> {
            try {
                view.evaluateJavascript(script, null);
            } catch (RuntimeException ignored) {
                // Diagnostics must never interfere with media delivery.
            }
        });
    }

    private static boolean isMediaPath(String path) {
        String normalized = path.toLowerCase(Locale.ROOT);
        return normalized.endsWith(".avif")
                || normalized.endsWith(".gif")
                || normalized.endsWith(".jpeg")
                || normalized.endsWith(".jpg")
                || normalized.endsWith(".m4a")
                || normalized.endsWith(".m4v")
                || normalized.endsWith(".mp3")
                || normalized.endsWith(".mp4")
                || normalized.endsWith(".ogg")
                || normalized.endsWith(".png")
                || normalized.endsWith(".svg")
                || normalized.endsWith(".ttf")
                || normalized.endsWith(".wav")
                || normalized.endsWith(".webm")
                || normalized.endsWith(".webp")
                || normalized.endsWith(".woff")
                || normalized.endsWith(".woff2");
    }

    private static boolean isVisualMediaPath(String path) {
        String normalized = path.toLowerCase(Locale.ROOT);
        return normalized.endsWith(".avif")
                || normalized.endsWith(".gif")
                || normalized.endsWith(".jpeg")
                || normalized.endsWith(".jpg")
                || normalized.endsWith(".png")
                || normalized.endsWith(".svg")
                || normalized.endsWith(".webp");
    }

    private boolean handleNavigation(Uri uri) {
        if (isInternalEventUrl(uri)) {
            dispatchInternalEvent(uri);
            return true;
        }

        if (uri != null && isAppHost(uri.getHost())) {
            return maybeOpenGoogleAuth(uri);
        }

        // Keep the native JavaScript bridge scoped to the trusted FoxiesDeck
        // document. External pages must never be rendered in this WebView.
        return openExternalUrl(uri);
    }

    private void dispatchInternalEvent(Uri uri) {
        String eventType = uri.getQueryParameter("type");
        if ("request_play_review".equals(eventType)) {
            try {
                Intent reviewIntent = new Intent(activity, EventReceiverActivity.class);
                reviewIntent.setData(uri);
                activity.startActivity(reviewIntent);
            } catch (Exception ignored) {
                // The Play review request is best-effort.
            }
            return;
        }

        try {
            Intent analyticsIntent = new Intent(activity, NativeAnalyticsReceiver.class);
            analyticsIntent.setData(uri);
            activity.sendBroadcast(analyticsIntent);
        } catch (Exception ignored) {
            // Analytics events are best-effort and must not interrupt WebView navigation.
        }
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
