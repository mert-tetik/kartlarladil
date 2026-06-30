"use client";

import type { CreateCardRequest, GeneratedCardResponse } from "@/features/cards/create-card-schema";

export async function generateCardRequest(input: CreateCardRequest): Promise<GeneratedCardResponse> {
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
}
