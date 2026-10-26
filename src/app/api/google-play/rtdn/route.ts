import { NextResponse } from "next/server";
import {
  claimGooglePlayRtdnEvent,
  completeGooglePlayRtdnEvent,
  GOOGLE_PLAY_RTDN_MANUAL_REVIEW_REQUIRED,
  syncGooglePlaySubscriptionFromRtdn,
  syncGooglePlayVoidedSubscriptionFromRtdn,
  verifyGooglePlayRtdnToken,
} from "@/features/subscriptions/google-play-service";
import {
  getGooglePlayErrorDetail,
  logGooglePlayError,
} from "@/features/subscriptions/google-play-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PubSubEnvelope {
  message?: {
    messageId?: string;
    data?: string;
  };
}

interface RealTimeDeveloperNotification {
  packageName?: string;
  subscriptionNotification?: {
    purchaseToken?: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number;
    refundType?: number;
  };
  pendingRefundReviewNotification?: {
    pendingRefundToken?: string;
    orderId?: string;
    refundReason?: number;
  };
  testNotification?: {
    version?: string;
  };
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function POST(request: Request) {
  const idToken = getBearerToken(request);
  if (!idToken) {
    return NextResponse.json({ error: "Missing Google Pub/Sub identity token." }, { status: 401 });
  }

  try {
    await verifyGooglePlayRtdnToken(idToken);
  } catch (error) {
    logGooglePlayError(
      "Google Play RTDN identity verification failed.",
      error,
      [idToken],
    );
    return NextResponse.json({ error: "Invalid Google Pub/Sub identity token." }, { status: 401 });
  }

  let envelope: PubSubEnvelope;
  try {
    envelope = (await request.json()) as PubSubEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid Google Pub/Sub payload." }, { status: 400 });
  }

  const messageId = envelope.message?.messageId;
  const encodedData = envelope.message?.data;
  if (!messageId || !encodedData) {
    return NextResponse.json({ error: "Missing Google Pub/Sub message data." }, { status: 400 });
  }

  let notification: RealTimeDeveloperNotification;
  try {
    notification = JSON.parse(Buffer.from(encodedData, "base64").toString("utf8")) as RealTimeDeveloperNotification;
  } catch {
    return NextResponse.json({ error: "Invalid Google Play RTDN data." }, { status: 400 });
  }

  if (notification.testNotification) {
    console.info("Google Play RTDN test notification acknowledged.");
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  const pendingRefund = notification.pendingRefundReviewNotification;
  if (pendingRefund) {
    if (!pendingRefund.pendingRefundToken || !pendingRefund.orderId) {
      return NextResponse.json({ error: "Invalid Google Play refund-review payload." }, { status: 400 });
    }

    try {
      const shouldProcess = await claimGooglePlayRtdnEvent(messageId, notification);
      if (!shouldProcess) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }

      // Refund decisions have financial and user-access consequences, so keep
      // the signed notification durably available for an operator instead of
      // automatically granting or denying the requested chargeback.
      console.error("Google Play RTDN refund review requires manual action within 24 hours.", {
        messageId,
        refundReason: pendingRefund.refundReason ?? null,
      });
      // Keep processed_at null and put the event into an explicit durable
      // operator queue. The claim helper recognizes this marker so Pub/Sub
      // duplicate deliveries do not re-queue or re-alert the same review.
      await completeGooglePlayRtdnEvent(
        messageId,
        null,
        GOOGLE_PLAY_RTDN_MANUAL_REVIEW_REQUIRED,
      );
      return NextResponse.json({ received: true, reviewRequired: true }, { status: 200 });
    } catch (error) {
      logGooglePlayError(
        "Google Play RTDN refund-review event could not be recorded.",
        error,
        [idToken],
      );
      return NextResponse.json({ error: "Google Play RTDN processing failed." }, { status: 500 });
    }
  }

  const voidedPurchase = notification.voidedPurchaseNotification;
  const voidedSubscription = voidedPurchase?.productType === 1
    ? voidedPurchase
    : null;
  if (voidedPurchase && !voidedSubscription) {
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  if (voidedSubscription && (!voidedSubscription.orderId || !voidedSubscription.purchaseToken)) {
    return NextResponse.json({ error: "Invalid voided subscription payload." }, { status: 400 });
  }

  const purchaseToken = notification.subscriptionNotification?.purchaseToken
    ?? voidedSubscription?.purchaseToken;
  if (!purchaseToken) {
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  try {
    const shouldProcess = await claimGooglePlayRtdnEvent(messageId, notification);
    if (!shouldProcess) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    const userId = voidedSubscription
      ? await syncGooglePlayVoidedSubscriptionFromRtdn(
          purchaseToken,
          voidedSubscription.orderId!,
          voidedSubscription.refundType ?? 0,
        )
      : await syncGooglePlaySubscriptionFromRtdn(purchaseToken);
    await completeGooglePlayRtdnEvent(
      messageId,
      userId,
      userId ? undefined : "No FoxiesDeck account is linked to this Google Play purchase token.",
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    logGooglePlayError(
      "Google Play RTDN processing failed.",
      error,
      [idToken, purchaseToken],
    );
    const safeMessage = getGooglePlayErrorDetail(error, [idToken, purchaseToken]);
    await completeGooglePlayRtdnEvent(
      messageId,
      null,
      safeMessage ?? "Google Play RTDN processing failed.",
    ).catch(() => undefined);
    return NextResponse.json({ error: "Google Play RTDN processing failed." }, { status: 500 });
  }
}
