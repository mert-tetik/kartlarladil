"use client";

import type { CreateCardRequest, GeneratedCardResponse } from "@/features/cards/create-card-schema";
import { CUSTOM_CARD_GENERATION_STALLED_EVENT } from "@/lib/slow-connection-quality";

const CUSTOM_CARD_GENERATION_STALL_MS = 20_000;

export async function generateCardRequest(input: CreateCardRequest): Promise<GeneratedCardResponse> {
  const stallTimer = window.setTimeout(() => {
    window.dispatchEvent(new Event(CUSTOM_CARD_GENERATION_STALLED_EVENT));
  }, CUSTOM_CARD_GENERATION_STALL_MS);

  try {
    const response = await fetch("/api/cards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => ({ errorCode: "unknown" }));

    if (!response.ok) {
      throw new Error(data.errorCode ?? "unknown");
    }

    return data as GeneratedCardResponse;
  } finally {
    window.clearTimeout(stallTimer);
  }
}
