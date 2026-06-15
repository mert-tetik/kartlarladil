import "server-only";

import crypto from "crypto";
import type { SubscriptionPlan } from "@/types/domain";

const LEMON_SQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1";

export function getVariantIdForPlan(
  plan: Exclude<SubscriptionPlan, "free">,
  cycle: "monthly" | "yearly" = "monthly",
): string {
  const envKey =
    plan === "basic"
      ? cycle === "yearly"
        ? "LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID"
        : "LEMONSQUEEZY_BASIC_VARIANT_ID"
      : cycle === "yearly"
        ? "LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID"
        : "LEMONSQUEEZY_PRO_VARIANT_ID";

  const variantId = process.env[envKey];

  if (!variantId) {
    throw new Error(`${envKey} is not configured.`);
  }

  return variantId;
}

export interface CreateCheckoutInput {
  userId: string;
  email: string;
  variantId: string;
  returnUrl: string;
}

export async function createCheckoutUrl(input: CreateCheckoutInput): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY is not configured.");
  }

  if (!storeId) {
    throw new Error("LEMONSQUEEZY_STORE_ID is not configured.");
  }

  const response = await fetch(`${LEMON_SQUEEZY_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          product_options: {
            redirect_url: input.returnUrl,
          },
          checkout_data: {
            email: input.email,
            custom: {
              user_id: input.userId,
            },
          },
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: input.variantId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    throw new Error(`LemonSqueezy checkout failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as LemonSqueezyCheckoutResponse;
  const url = payload.data?.attributes?.url;

  if (!url) {
    throw new Error("LemonSqueezy checkout response did not include a URL.");
  }

  return url;
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

interface LemonSqueezyCheckoutResponse {
  data?: {
    attributes?: {
      url?: string;
    };
  };
}
