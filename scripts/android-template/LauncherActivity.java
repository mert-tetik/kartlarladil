package __PACKAGE__;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import java.util.Arrays;

public class LauncherActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST_CODE = 4101;
    private WebView webView;
    private FrameLayout contentRoot;
    private NativeBillingBridge billingBridge;
    private NativeTextToSpeechBridge textToSpeechBridge;
    private PermissionRequest pendingAudioPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        webView.setBackgroundColor(Color.WHITE);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (!isTrustedOrigin(request.getOrigin()) || !requestsAudioOnly(request)) {
                    request.deny();
                    return;
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    pendingAudioPermissionRequest = request;
                    requestPermissions(
                            new String[]{Manifest.permission.RECORD_AUDIO},
                            AUDIO_PERMISSION_REQUEST_CODE
                    );
                    return;
                }

                request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingAudioPermissionRequest == request) {
                    pendingAudioPermissionRequest = null;
                }
            }
        });

        NativeMediaStore mediaStore = new NativeMediaStore(this);
        webView.setWebViewClient(new LocalMediaWebViewClient(this, mediaStore));

        billingBridge = new NativeBillingBridge(this);
        webView.addJavascriptInterface(billingBridge, "FoxiesDeckNativeBilling");
        textToSpeechBridge = new NativeTextToSpeechBridge(this);
        webView.addJavascriptInterface(textToSpeechBridge, "FoxiesDeckNativeSpeech");

        contentRoot = new FrameLayout(this);
        contentRoot.setBackgroundColor(Color.BLACK);
        contentRoot.addView(
                webView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(contentRoot);
        configureWindow();
        loadStartUrl(getIntent());
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getDecorView().getWindowInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        }
        configureSystemBarInsets();
        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
    }

    /**
     * Keep the whole remote WebView inside the usable area. Android 15+ forces
     * edge-to-edge for apps targeting API 35+, so relying on legacy decor-fit
     * behavior leaves fixed web UI behind the status/navigation bars.
     *
     * The root consumes the dimensions it uses as padding before dispatching
     * insets to WebView. This prevents WebView from applying the same system
     * bar inset a second time through its CSS safe-area handling.
     */
    private void configureSystemBarInsets() {
        contentRoot.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                int systemTypes = WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout();
                android.graphics.Insets system = insets.getInsets(systemTypes);
                int gestureTypes = WindowInsets.Type.systemGestures()
                        | WindowInsets.Type.mandatorySystemGestures();
                android.graphics.Insets gestures = insets.getInsets(gestureTypes);
                left = Math.max(system.left, gestures.left);
                top = system.top;
                right = Math.max(system.right, gestures.right);
                bottom = Math.max(system.bottom, gestures.bottom);
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        && insets.getDisplayCutout() != null) {
                    android.view.DisplayCutout cutout = insets.getDisplayCutout();
                    left = Math.max(left, cutout.getSafeInsetLeft());
                    top = Math.max(top, cutout.getSafeInsetTop());
                    right = Math.max(right, cutout.getSafeInsetRight());
                    bottom = Math.max(bottom, cutout.getSafeInsetBottom());
                }
            }

            view.setPadding(left, top, right, bottom);
            return consumeSystemBarInsets(insets);
        });
        contentRoot.requestApplyInsets();
    }

    private WindowInsets consumeSystemBarInsets(WindowInsets insets) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            int systemTypes = WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout();
            return new WindowInsets.Builder(insets)
                    .setInsets(systemTypes, android.graphics.Insets.NONE)
                    .build();
        }

        WindowInsets consumed = insets.consumeSystemWindowInsets();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            consumed = consumed.consumeDisplayCutout();
        }
        return consumed;
    }

    private void loadStartUrl(Intent intent) {
        Uri requested = intent == null ? null : intent.getData();
        Uri base = requested != null && isAppUrl(requested)
                ? requested
                : Uri.parse(getString(R.string.launchUrl));
        Uri launch = base.buildUpon()
                .appendQueryParameter("twa", "1")
                .appendQueryParameter("native", "1")
                .build();
        webView.loadUrl(launch.toString());
    }

    private boolean isAppUrl(Uri uri) {
        String host = uri.getHost();
        return "www.foxiesdeck.com".equalsIgnoreCase(host)
                || "foxiesdeck.com".equalsIgnoreCase(host);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getData() != null && isAppUrl(intent.getData())) {
            loadStartUrl(intent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != AUDIO_PERMISSION_REQUEST_CODE) return;

        PermissionRequest request = pendingAudioPermissionRequest;
        pendingAudioPermissionRequest = null;
        if (request == null) return;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            request.deny();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingAudioPermissionRequest != null) {
            pendingAudioPermissionRequest.deny();
            pendingAudioPermissionRequest = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("FoxiesDeckNativeBilling");
            webView.removeJavascriptInterface("FoxiesDeckNativeSpeech");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        if (billingBridge != null) {
            billingBridge.close();
            billingBridge = null;
        }
        if (textToSpeechBridge != null) {
            textToSpeechBridge.close();
            textToSpeechBridge = null;
        }
        super.onDestroy();
    }

    private static boolean requestsAudioOnly(PermissionRequest request) {
        String[] resources = request.getResources();
        return resources != null
                && resources.length == 1
                && Arrays.asList(resources).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
    }

    private static boolean isTrustedOrigin(Uri origin) {
        if (origin == null || !"https".equalsIgnoreCase(origin.getScheme())) return false;
        String host = origin.getHost();
        return "www.foxiesdeck.com".equalsIgnoreCase(host)
                || "foxiesdeck.com".equalsIgnoreCase(host);
    }
}
