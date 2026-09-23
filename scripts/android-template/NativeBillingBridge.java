package __PACKAGE__;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

public final class NativeBillingBridge implements PurchasesUpdatedListener {
    private static final long WAIT_SECONDS = 20L;

    private final Activity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final BillingClient billingClient;
    private final Object purchaseLock = new Object();
    private PurchaseWaiter pendingPurchase;

    public NativeBillingBridge(Activity activity) {
        this.activity = activity;
        billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enableAutoServiceReconnection()
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder()
                                .enableOneTimeProducts()
                                .enablePrepaidPlans()
                                .build()
                )
                .build();
    }

    @JavascriptInterface
    public String getDetails(String itemIdsJson) {
        try {
            JSONArray ids = new JSONArray(itemIdsJson);
            List<String> itemIds = new ArrayList<>();
            for (int i = 0; i < ids.length(); i++) {
                String itemId = ids.optString(i, "").trim();
                if (!itemId.isEmpty()) itemIds.add(itemId);
            }

            List<ProductDetails> products = queryProducts(itemIds);
            JSONArray response = new JSONArray();
            for (ProductDetails product : products) response.put(toDigitalGoodsDetails(product));
            return response.toString();
        } catch (Exception error) {
            return errorResponse(error.getMessage());
        }
    }

    @JavascriptInterface
    public String listPurchases() {
        if (!ensureReady()) return errorResponse("Google Play Billing could not connect.");

        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<List<Purchase>> purchasesRef = new AtomicReference<>(new ArrayList<>());
        AtomicReference<String> errorRef = new AtomicReference<>();

        mainHandler.post(() -> billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build(),
                new PurchasesResponseListener() {
                    @Override
                    public void onQueryPurchasesResponse(BillingResult result, List<Purchase> purchases) {
                        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                            purchasesRef.set(purchases == null ? new ArrayList<>() : purchases);
                        } else {
                            errorRef.set(result.getDebugMessage());
                        }
                        latch.countDown();
                    }
                }
        ));

        if (!await(latch)) return errorResponse("Google Play purchase list timed out.");
        if (errorRef.get() != null) return errorResponse(errorRef.get());

        JSONArray response = new JSONArray();
        for (Purchase purchase : purchasesRef.get()) {
            for (String productId : purchase.getProducts()) {
                JSONObject item = new JSONObject();
                put(item, "itemId", productId);
                put(item, "purchaseToken", purchase.getPurchaseToken());
                response.put(item);
            }
        }
        return response.toString();
    }

    @JavascriptInterface
    public String purchase(String itemId) {
        try {
            String normalizedItemId = itemId == null ? "" : itemId.trim();
            if (normalizedItemId.isEmpty()) return errorResponse("Missing Google Play product id.");

            List<ProductDetails> products = queryProducts(java.util.Collections.singletonList(normalizedItemId));
            if (products.isEmpty()) return errorResponse("Google Play product is unavailable.");

            ProductDetails product = products.get(0);
            ProductDetails.SubscriptionOfferDetails selectedOffer = selectBasePlanOffer(product);
            if (selectedOffer == null) return errorResponse("Google Play subscription offer is unavailable.");

            BillingFlowParams.ProductDetailsParams productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(product)
                    .setOfferToken(selectedOffer.getOfferToken())
                    .build();
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(java.util.Collections.singletonList(productParams))
                    .build();

            PurchaseWaiter waiter = new PurchaseWaiter();
            synchronized (purchaseLock) {
                if (pendingPurchase != null) return errorResponse("Another Google Play purchase is already in progress.");
                pendingPurchase = waiter;
            }

            mainHandler.post(() -> {
                BillingResult result = billingClient.launchBillingFlow(activity, flowParams);
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    waiter.complete(errorResponse(result.getDebugMessage()));
                }
            });

            if (!await(waiter.latch, 120L)) {
                waiter.complete(errorResponse("Google Play purchase timed out."));
            }
            synchronized (purchaseLock) {
                if (pendingPurchase == waiter) pendingPurchase = null;
            }
            return waiter.response.get();
        } catch (Exception error) {
            return errorResponse(error.getMessage());
        }
    }

    private List<ProductDetails> queryProducts(List<String> itemIds) throws Exception {
        if (!ensureReady()) throw new IllegalStateException("Google Play Billing could not connect.");

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String itemId : itemIds) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(itemId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());
        }

        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<List<ProductDetails>> productsRef = new AtomicReference<>(new ArrayList<>());
        AtomicReference<String> errorRef = new AtomicReference<>();

        mainHandler.post(() -> billingClient.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(products).build(),
                (BillingResult result, QueryProductDetailsResult queryResult) -> {
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && queryResult != null) {
                        productsRef.set(queryResult.getProductDetailsList());
                    } else {
                        errorRef.set(result.getDebugMessage());
                    }
                    latch.countDown();
                }
        ));

        if (!await(latch)) throw new IllegalStateException("Google Play product query timed out.");
        if (errorRef.get() != null) throw new IllegalStateException(errorRef.get());
        return productsRef.get();
    }

    private boolean ensureReady() {
        if (billingClient.isReady()) return true;
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Boolean> ready = new AtomicReference<>(false);
        mainHandler.post(() -> billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                ready.set(result.getResponseCode() == BillingClient.BillingResponseCode.OK);
                latch.countDown();
            }

            @Override
            public void onBillingServiceDisconnected() {
                latch.countDown();
            }
        }));
        return await(latch) && Boolean.TRUE.equals(ready.get());
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PurchaseWaiter waiter;
        synchronized (purchaseLock) {
            waiter = pendingPurchase;
        }
        if (waiter == null) return;

        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK
                && purchases != null
                && !purchases.isEmpty()) {
            Purchase purchase = purchases.get(0);
            String itemId = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
            JSONObject response = new JSONObject();
            put(response, "status", "success");
            put(response, "itemId", itemId);
            put(response, "purchaseToken", purchase.getPurchaseToken());
            waiter.complete(response.toString());
        } else if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            waiter.complete(errorResponse("Purchase canceled."));
        } else {
            waiter.complete(errorResponse(result.getDebugMessage()));
        }
    }

    private JSONObject toDigitalGoodsDetails(ProductDetails product) {
        JSONObject result = new JSONObject();
        put(result, "itemId", product.getProductId());
        put(result, "title", product.getTitle());
        put(result, "description", product.getDescription());
        put(result, "type", "subscription");

        ProductDetails.SubscriptionOfferDetails selectedOffer = selectBasePlanOffer(product);
        if (selectedOffer != null) {
            List<ProductDetails.PricingPhase> phases = selectedOffer.getPricingPhases().getPricingPhaseList();
            if (phases != null && !phases.isEmpty()) {
                ProductDetails.PricingPhase phase = phases.get(phases.size() - 1);
                JSONObject price = new JSONObject();
                put(price, "currency", phase.getPriceCurrencyCode());
                put(price, "value", formatMicros(phase.getPriceAmountMicros()));
                put(result, "price", price);
                put(result, "subscriptionPeriod", phase.getBillingPeriod());
            }
        }
        return result;
    }

    private static ProductDetails.SubscriptionOfferDetails selectBasePlanOffer(ProductDetails product) {
        List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;

        // Billing may return introductory offers before the base plan. Keep
        // the displayed price and the launch offer aligned and deterministic.
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (offer.getOfferId() == null || offer.getOfferId().isEmpty()) return offer;
        }
        return offers.get(0);
    }

    private static String formatMicros(long micros) {
        return BigDecimal.valueOf(micros)
                .divide(BigDecimal.valueOf(1_000_000L), 6, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString();
    }

    private static String errorResponse(String message) {
        JSONObject response = new JSONObject();
        put(response, "status", "error");
        put(response, "message", message == null || message.isEmpty()
                ? "Google Play Billing request failed."
                : message);
        return response.toString();
    }

    private static void put(JSONObject object, String key, Object value) {
        try {
            object.put(key, value);
        } catch (JSONException error) {
            throw new IllegalStateException("Could not serialize native billing response.", error);
        }
    }

    private static boolean await(CountDownLatch latch) {
        return await(latch, WAIT_SECONDS);
    }

    private static boolean await(CountDownLatch latch, long seconds) {
        try {
            return latch.await(seconds, TimeUnit.SECONDS);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    public void close() {
        mainHandler.post(billingClient::endConnection);
    }

    private static final class PurchaseWaiter {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicReference<String> response = new AtomicReference<>(errorResponse("Google Play purchase did not finish."));

        void complete(String value) {
            response.set(value);
            latch.countDown();
        }
    }
}
