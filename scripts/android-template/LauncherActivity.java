package __PACKAGE__;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.View;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.content.FileProvider;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.ValueCallback;
import org.json.JSONObject;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;

public class LauncherActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST_CODE = 4101;
    private WebView webView;
    private FrameLayout contentRoot;
    private FrameLayout nativeLaunchOverlay;
    private ImageView nativeSplashView;
    private NativeLoadingIndicatorView nativeLoadingView;
    private NativeBillingBridge billingBridge;
    private NativeTextToSpeechBridge textToSpeechBridge;
    private NativeVibrationBridge vibrationBridge;
    private PermissionRequest pendingAudioPermissionRequest;
    private ValueCallback<Uri[]> pendingFileChooserCallback;
    private Uri pendingCameraUri;
    private File pendingCameraFile;
    private AppUpdateManager appUpdateManager;
    private Intent pendingLaunchIntent;
    private boolean updateCheckInFlight;
    private boolean updateCheckCompleted;
    private boolean immediateUpdateFlowActive;
    private boolean startUrlLoaded;
    private boolean backPressInFlight;
    private final OnBackInvokedCallback androidBackCallback = this::handleBackPressed;
    private static final int FILE_CHOOSER_REQUEST_CODE = 4102;
    private static final int IMMEDIATE_UPDATE_REQUEST_CODE = 4103;
    private static final AppUpdateOptions IMMEDIATE_UPDATE_OPTIONS =
            AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        pendingLaunchIntent = getIntent();
        contentRoot = new FrameLayout(this);
        // API 35+ enforces edge-to-edge for target API 36. Keep the native
        // root black so transparent system-bar regions never inherit the
        // orange launch surface; the orange overlay is inset into the app
        // content area by configureSystemBarInsets().
        contentRoot.setBackgroundColor(Color.BLACK);
        nativeLaunchOverlay = createNativeLaunchOverlay();
        contentRoot.addView(
                nativeLaunchOverlay,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        setContentView(contentRoot);
        configureWindow();
        registerAndroidBackCallback();

        // Let Android draw the local launch surface first. The native loader
        // then takes over before WebView and bridge setup begins, so the user
        // never depends on a WebView frame for the first loading indicator.
        contentRoot.post(this::beginWebViewStartup);
    }

    private FrameLayout createNativeLaunchOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.rgb(254, 101, 7));

        nativeSplashView = createNativeSplashView();
        overlay.addView(
                nativeSplashView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );

        nativeLoadingView = new NativeLoadingIndicatorView(this);
        nativeLoadingView.setAlpha(0f);
        nativeLoadingView.setVisibility(View.INVISIBLE);
        overlay.addView(
                nativeLoadingView,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );
        return overlay;
    }

    private ImageView createNativeSplashView() {
        ImageView splash = new ImageView(this);
        splash.setImageResource(R.drawable.native_splash);
        splash.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        splash.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        return splash;
    }

    private void beginWebViewStartup() {
        if (isFinishing() || nativeLoadingView == null) return;

        // Give the local wordmark one rendered frame before the loader takes
        // over. This is a visual handoff only; it does not delay WebView work.
        showNativeLoadingScreen();
        contentRoot.post(this::initializeWebView);
    }

    private void showNativeLoadingScreen() {
        if (nativeLoadingView == null || nativeLaunchOverlay == null) return;

        nativeLoadingView.setVisibility(View.VISIBLE);
        nativeLoadingView.startAnimating();
        nativeLoadingView.animate()
                .alpha(1f)
                .setDuration(180L)
                .start();

        if (nativeSplashView != null) {
            ImageView splash = nativeSplashView;
            splash.animate()
                    .alpha(0f)
                    .setDuration(180L)
                    .withEndAction(() -> splash.setVisibility(View.GONE))
                    .start();
        }
    }

    private void initializeWebView() {
        if (webView != null || isFinishing()) return;

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        // The app owns its responsive typography. Do not let the Android
        // system font-scale preference resize WebView text and destabilize
        // the mobile layout.
        settings.setTextZoom(100);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        // Keep the native launch overlay above the WebView until the first
        // committed web frame. This avoids a black intermediate surface and
        // keeps the native three-dot loader independent of WebView startup.
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (pendingFileChooserCallback != null) {
                    pendingFileChooserCallback.onReceiveValue(null);
                }
                deletePendingCameraCapture();

                pendingFileChooserCallback = filePathCallback;
                Intent chooserIntent;
                try {
                    chooserIntent = fileChooserParams.isCaptureEnabled() && acceptsImage(fileChooserParams)
                            ? createCameraCaptureIntent()
                            : fileChooserParams.createIntent();
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception ignored) {
                    deletePendingCameraCapture();
                    pendingFileChooserCallback = null;
                    filePathCallback.onReceiveValue(null);
                    return false;
                }
                return true;
            }

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
        webView.setWebViewClient(new LocalMediaWebViewClient(this, mediaStore, this::hideNativeLaunchOverlay));

        billingBridge = new NativeBillingBridge(this);
        webView.addJavascriptInterface(billingBridge, "FoxiesDeckNativeBilling");
        textToSpeechBridge = new NativeTextToSpeechBridge(this, webView);
        webView.addJavascriptInterface(textToSpeechBridge, "FoxiesDeckNativeSpeech");
        vibrationBridge = new NativeVibrationBridge(this);
        webView.addJavascriptInterface(vibrationBridge, "FoxiesDeckNativeVibration");

        contentRoot.addView(
                webView,
                0,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                )
        );

        // The app must never wait for Play Core. The native loader can remain
        // visible while the update check runs independently in the background.
        continueLaunch();
        contentRoot.post(this::checkForImmediateUpdate);
    }

    private void hideNativeLaunchOverlay() {
        if (nativeLaunchOverlay == null || contentRoot == null) return;

        if (nativeLoadingView != null) {
            nativeLoadingView.stopAnimating();
        }

        FrameLayout overlay = nativeLaunchOverlay;
        nativeLaunchOverlay = null;
        nativeSplashView = null;
        nativeLoadingView = null;
        overlay.animate()
                .alpha(0f)
                .setDuration(120L)
                .withEndAction(() -> contentRoot.removeView(overlay))
                .start();
    }

    /**
     * Check Google Play's native immediate update flow without blocking the
     * first WebView load. Sideloaded/debug builds simply continue when Play
     * cannot provide update information.
     */
    private void checkForImmediateUpdate() {
        if (webView == null
                || updateCheckCompleted
                || updateCheckInFlight
                || immediateUpdateFlowActive) return;
        updateCheckInFlight = true;
        try {
            appUpdateManager = AppUpdateManagerFactory.create(this);
            appUpdateManager.getAppUpdateInfo()
                    .addOnSuccessListener(appUpdateInfo -> {
                        updateCheckInFlight = false;
                        updateCheckCompleted = true;
                        handleAppUpdateInfo(appUpdateInfo);
                    })
                    .addOnFailureListener(error -> {
                        updateCheckInFlight = false;
                        updateCheckCompleted = true;
                        continueLaunch();
                    });
        } catch (RuntimeException ignored) {
            updateCheckInFlight = false;
            updateCheckCompleted = true;
            continueLaunch();
        }
    }

    private void handleAppUpdateInfo(AppUpdateInfo appUpdateInfo) {
        boolean updateAvailable = appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE;
        boolean updateAlreadyInProgress = appUpdateInfo.updateAvailability()
                == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;

        if ((updateAvailable || updateAlreadyInProgress)
                && appUpdateInfo.isUpdateTypeAllowed(IMMEDIATE_UPDATE_OPTIONS)) {
            immediateUpdateFlowActive = true;
            try {
                boolean started = appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo,
                        this,
                        IMMEDIATE_UPDATE_OPTIONS,
                        IMMEDIATE_UPDATE_REQUEST_CODE
                );
                if (!started) {
                    immediateUpdateFlowActive = false;
                    finish();
                }
            } catch (IntentSender.SendIntentException | RuntimeException ignored) {
                // A broken/unavailable Play flow must not leave a blank shell.
                immediateUpdateFlowActive = false;
                finish();
            }
            return;
        }

        continueLaunch();
    }

    private void continueLaunch() {
        if (webView == null || startUrlLoaded || isFinishing()) return;
        startUrlLoaded = true;
        loadStartUrl(pendingLaunchIntent != null ? pendingLaunchIntent : getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        // If Android recreated/resumed the shell while Play had an update in
        // progress, ask Play for a fresh AppUpdateInfo and resume the flow.
        if (webView != null) {
            checkForImmediateUpdate();
        }
    }

    private Intent createCameraCaptureIntent() throws IOException {
        File cameraDirectory = new File(getCacheDir(), "camera");
        if (!cameraDirectory.exists() && !cameraDirectory.mkdirs()) {
            throw new IOException("Unable to create camera cache directory");
        }

        File outputFile = File.createTempFile("foxiesdeck-camera-", ".jpg", cameraDirectory);
        Uri outputUri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                outputFile
        );
        pendingCameraFile = outputFile;
        pendingCameraUri = outputUri;

        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, outputUri);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.setClipData(ClipData.newRawUri("output", outputUri));
        return intent;
    }

    private static boolean acceptsImage(WebChromeClient.FileChooserParams params) {
        String[] acceptTypes = params.getAcceptTypes();
        if (acceptTypes == null || acceptTypes.length == 0) return true;

        for (String acceptType : acceptTypes) {
            if (acceptType == null || acceptType.isEmpty() || acceptType.startsWith("image/")) {
                return true;
            }
        }
        return false;
    }

    private void deletePendingCameraCapture() {
        if (pendingCameraFile != null && pendingCameraFile.exists()) {
            //noinspection ResultOfMethodCallIgnored
            pendingCameraFile.delete();
        }
        pendingCameraFile = null;
        pendingCameraUri = null;
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.setNavigationBarDividerColor(Color.BLACK);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getDecorView().getWindowInsetsController();
            if (controller != null) {
                int lightSystemBars = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(0, lightSystemBars);
            }
        }
        configureSystemBarInsets();
        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
    }

    /**
     * Keep the remote WebView clear of the top and bottom system bars. Android
     * 15+ forces edge-to-edge for apps targeting API 35+, so relying on legacy
     * decor-fit behavior leaves fixed web UI behind the status/navigation bars.
     *
     * Do not apply system-gesture insets to the whole root. Those insets mark
     * horizontal touch areas reserved for OS edge gestures; using them as root
     * padding shrinks every web page and exposes the black native background as
     * unwanted side bars on some devices. The web UI owns its horizontal
     * responsive padding, while the native root only reserves vertical system
     * bars. The root consumes the system-bar dimensions before dispatching
     * insets to WebView to avoid applying them twice.
     */
    private void configureSystemBarInsets() {
        contentRoot.setOnApplyWindowInsetsListener((view, insets) -> {
            int top;
            int bottom;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                int systemTypes = WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout();
                android.graphics.Insets system = insets.getInsets(systemTypes);
                top = system.top;
                bottom = system.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        && insets.getDisplayCutout() != null) {
                    android.view.DisplayCutout cutout = insets.getDisplayCutout();
                    top = Math.max(top, cutout.getSafeInsetTop());
                    bottom = Math.max(bottom, cutout.getSafeInsetBottom());
                }
            }

            view.setPadding(0, top, 0, bottom);
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
        Uri base = requested != null && isNativeAuthCallbackUrl(requested)
                ? toWebNativeAuthLandingUrl(requested)
                : requested != null && isAppUrl(requested)
                ? requested
                : Uri.parse(getString(R.string.launchUrl));
        Uri launch = base.buildUpon()
                .appendQueryParameter("twa", "1")
                .appendQueryParameter("native", "1")
                .build();

        if (!hasValidatedInternet()) {
            Uri offline = new Uri.Builder()
                    .scheme("https")
                    .authority("www.foxiesdeck.com")
                    .path("/~offline")
                    .appendQueryParameter("returnTo", launch.toString())
                    .build();
            webView.loadUrl(offline.toString());
            return;
        }

        webView.loadUrl(launch.toString());
    }

    private boolean hasValidatedInternet() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (manager == null) return false;

        Network activeNetwork = manager.getActiveNetwork();
        if (activeNetwork == null) return false;

        NetworkCapabilities capabilities = manager.getNetworkCapabilities(activeNetwork);
        return capabilities != null
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
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
        if (!startUrlLoaded) {
            pendingLaunchIntent = intent;
            return;
        }
        if (intent != null && isNativeAuthCallbackUrl(intent.getData())) {
            dispatchNativeGoogleAuthCallback(intent.getData());
            return;
        }
        if (intent != null && intent.getData() != null && isAppUrl(intent.getData())) {
            loadStartUrl(intent);
        }
    }

    private static boolean isNativeAuthCallbackUrl(Uri uri) {
        return uri != null
                && "foxiesdeck".equalsIgnoreCase(uri.getScheme())
                && "auth".equalsIgnoreCase(uri.getHost())
                && "/callback".equals(uri.getPath());
    }

    private void dispatchNativeGoogleAuthCallback(Uri nativeCallback) {
        if (webView == null || nativeCallback == null) return;

        String code = nativeCallback.getQueryParameter("code");
        String next = nativeCallback.getQueryParameter("next");
        String error = nativeCallback.getQueryParameter("error");
        String errorDescription = nativeCallback.getQueryParameter("error_description");
        String payload = "{"
                + "code:" + quoteForJavaScript(code) + ","
                + "next:" + quoteForJavaScript(next) + ","
                + "error:" + quoteForJavaScript(error) + ","
                + "errorDescription:" + quoteForJavaScript(errorDescription)
                + "}";
        String script = "(function(){"
                + "var payload=" + payload + ";"
                + "window.__foxiesdeckNativeGoogleAuthQueue="
                + "window.__foxiesdeckNativeGoogleAuthQueue||[];"
                + "window.__foxiesdeckNativeGoogleAuthQueue.push(payload);"
                + "if(typeof window.FoxiesDeckNativeGoogleAuthCallback==='function')"
                + "{window.FoxiesDeckNativeGoogleAuthCallback();}"
                + "window.dispatchEvent(new CustomEvent('foxiesdeck:native-google-auth-callback'));"
                + "})();";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private static String quoteForJavaScript(String value) {
        return JSONObject.quote(value == null ? "" : value);
    }

    private static Uri toWebNativeAuthLandingUrl(Uri nativeCallback) {
        Uri.Builder webCallback = new Uri.Builder()
                .scheme("https")
                .authority("www.foxiesdeck.com")
                .path("/");

        appendQueryParameterIfPresent(webCallback, "nativeAuthCode", nativeCallback.getQueryParameter("code"));
        appendQueryParameterIfPresent(webCallback, "nativeAuthNext", nativeCallback.getQueryParameter("next"));
        appendQueryParameterIfPresent(webCallback, "nativeAuthError", nativeCallback.getQueryParameter("error"));
        appendQueryParameterIfPresent(
                webCallback,
                "nativeAuthErrorDescription",
                nativeCallback.getQueryParameter("error_description")
        );

        return webCallback.build();
    }

    private static void appendQueryParameterIfPresent(Uri.Builder builder, String key, String value) {
        if (value != null && !value.isEmpty()) {
            builder.appendQueryParameter(key, value);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == IMMEDIATE_UPDATE_REQUEST_CODE) {
            immediateUpdateFlowActive = false;
            if (resultCode == RESULT_OK) {
                continueLaunch();
            } else {
                // Immediate updates are mandatory for this release. Do not
                // allow the old version to continue after an explicit cancel.
                finish();
            }
            return;
        }
        if (requestCode != FILE_CHOOSER_REQUEST_CODE) return;

        ValueCallback<Uri[]> callback = pendingFileChooserCallback;
        pendingFileChooserCallback = null;
        if (callback != null) {
            Uri[] results = pendingCameraUri != null
                    ? (resultCode == RESULT_OK && pendingCameraFile != null && pendingCameraFile.length() > 0
                    ? new Uri[]{pendingCameraUri}
                    : null)
                    : WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            callback.onReceiveValue(results);
        }
        deletePendingCameraCapture();
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

    private void registerAndroidBackCallback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    androidBackCallback
            );
        }
    }

    private void handleBackPressed() {
        if (isOfflineScreenVisible()) {
            return;
        }
        if (backPressInFlight) {
            return;
        }
        if (webView == null) {
            finish();
            return;
        }

        backPressInFlight = true;
        try {
            webView.evaluateJavascript(
                    "(function(){try{return window.__foxiesDeckHandleAndroidBack ? window.__foxiesDeckHandleAndroidBack() : false;}catch(_){return false;}})()",
                    handled -> {
                        backPressInFlight = false;
                        if (!isFinishing() && !"true".equals(handled)) {
                            finish();
                        }
                    }
            );
        } catch (RuntimeException ignored) {
            backPressInFlight = false;
            finish();
        }
    }

    @Override
    public void onBackPressed() {
        handleBackPressed();
    }

    private boolean isOfflineScreenVisible() {
        if (webView == null || webView.getUrl() == null) return false;
        String path = Uri.parse(webView.getUrl()).getPath();
        return "/~offline".equals(path) || "/~offline/".equals(path);
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(androidBackCallback);
        }
        if (pendingAudioPermissionRequest != null) {
            pendingAudioPermissionRequest.deny();
            pendingAudioPermissionRequest = null;
        }
        if (pendingFileChooserCallback != null) {
            pendingFileChooserCallback.onReceiveValue(null);
            pendingFileChooserCallback = null;
        }
        deletePendingCameraCapture();
        if (nativeLoadingView != null) {
            nativeLoadingView.stopAnimating();
        }
        if (webView != null) {
            webView.removeJavascriptInterface("FoxiesDeckNativeBilling");
            webView.removeJavascriptInterface("FoxiesDeckNativeSpeech");
            webView.removeJavascriptInterface("FoxiesDeckNativeVibration");
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
        if (vibrationBridge != null) {
            vibrationBridge.close();
            vibrationBridge = null;
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
