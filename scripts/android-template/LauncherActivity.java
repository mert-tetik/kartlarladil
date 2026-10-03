package __PACKAGE__;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import androidx.core.content.FileProvider;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.ValueCallback;

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
    private boolean immediateUpdateFlowActive;
    private boolean startUrlLoaded;
    private static final int FILE_CHOOSER_REQUEST_CODE = 4102;
    private static final int IMMEDIATE_UPDATE_REQUEST_CODE = 4103;
    private static final AppUpdateOptions IMMEDIATE_UPDATE_OPTIONS =
            AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build();

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
        webView.setBackgroundColor(Color.BLACK);
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
        webView.setWebViewClient(new LocalMediaWebViewClient(this, mediaStore));

        billingBridge = new NativeBillingBridge(this);
        webView.addJavascriptInterface(billingBridge, "FoxiesDeckNativeBilling");
        textToSpeechBridge = new NativeTextToSpeechBridge(this);
        webView.addJavascriptInterface(textToSpeechBridge, "FoxiesDeckNativeSpeech");
        vibrationBridge = new NativeVibrationBridge(this);
        webView.addJavascriptInterface(vibrationBridge, "FoxiesDeckNativeVibration");

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
        pendingLaunchIntent = getIntent();
        checkForImmediateUpdate();
    }

    /**
     * Gate the first WebView load behind Google Play's native immediate update
     * flow. Sideloaded/debug builds simply continue when Play cannot provide
     * update information.
     */
    private void checkForImmediateUpdate() {
        if (startUrlLoaded || updateCheckInFlight || immediateUpdateFlowActive) return;
        updateCheckInFlight = true;
        try {
            appUpdateManager = AppUpdateManagerFactory.create(this);
            appUpdateManager.getAppUpdateInfo()
                    .addOnSuccessListener(appUpdateInfo -> {
                        updateCheckInFlight = false;
                        handleAppUpdateInfo(appUpdateInfo);
                    })
                    .addOnFailureListener(error -> {
                        updateCheckInFlight = false;
                        continueLaunch();
                    });
        } catch (RuntimeException ignored) {
            updateCheckInFlight = false;
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
            } catch (RuntimeException ignored) {
                // A broken/unavailable Play flow must not leave a blank shell.
                immediateUpdateFlowActive = false;
                finish();
            }
            return;
        }

        continueLaunch();
    }

    private void continueLaunch() {
        if (startUrlLoaded || isFinishing()) return;
        startUrlLoaded = true;
        loadStartUrl(pendingLaunchIntent != null ? pendingLaunchIntent : getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        // If Android recreated/resumed the shell while Play had an update in
        // progress, ask Play for a fresh AppUpdateInfo and resume the flow.
        checkForImmediateUpdate();
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
        if (!startUrlLoaded) {
            pendingLaunchIntent = intent;
            return;
        }
        if (intent != null && intent.getData() != null && isAppUrl(intent.getData())) {
            loadStartUrl(intent);
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
        if (pendingFileChooserCallback != null) {
            pendingFileChooserCallback.onReceiveValue(null);
            pendingFileChooserCallback = null;
        }
        deletePendingCameraCapture();
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
