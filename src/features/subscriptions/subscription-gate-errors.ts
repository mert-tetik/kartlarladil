export type SubscriptionGateOperation =
  | "entitlements"
  | "ai_usage"
  | "image_translation_quota"
  | "game_reward";

export class SubscriptionGateUnavailableError extends Error {
  readonly operation: SubscriptionGateOperation;

  constructor(operation: SubscriptionGateOperation) {
    super("subscription_service_unavailable");
    this.name = "SubscriptionGateUnavailableError";
    this.operation = operation;
  }
}

export function throwSubscriptionGateUnavailable(
  operation: SubscriptionGateOperation,
  error: unknown,
): never {
  const metadata = getSafeErrorMetadata(error);
  console.error("Subscription gate backend check failed.", { operation, ...metadata });
  throw new SubscriptionGateUnavailableError(operation);
}

function getSafeErrorMetadata(error: unknown): {
  code?: string;
  status?: number;
} {
  if (!error || typeof error !== "object") return {};

  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" && /^[A-Z0-9_.-]{1,64}$/iu.test(record.code)
    ? record.code
    : undefined;
  const status = typeof record.status === "number"
    && Number.isInteger(record.status)
    && record.status >= 100
    && record.status <= 599
    ? record.status
    : undefined;

  return {
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
  };
}
