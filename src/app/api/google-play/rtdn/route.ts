import { NextResponse } from "next/server";
import {
  claimGooglePlayRtdnEvent,
  completeGooglePlayRtdnEvent,
  syncGooglePlaySubscriptionFromRtdn,
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
  subscriptionNotification?: {
    purchaseToken?: string;
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

  const purchaseToken = notification.subscriptionNotification?.purchaseToken;
  if (!purchaseToken) {
    if (notification.testNotification) {
      console.info("Google Play RTDN test notification acknowledged.");
    }
    return NextResponse.json({ received: true, skipped: true }, { status: 200 });
  }

  try {
    const shouldProcess = await claimGooglePlayRtdnEvent(messageId, notification);
    if (!shouldProcess) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    const userId = await syncGooglePlaySubscriptionFromRtdn(purchaseToken);
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
