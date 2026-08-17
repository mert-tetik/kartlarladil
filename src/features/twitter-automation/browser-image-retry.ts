const BROWSER_IMAGE_ERROR_CODE_PATTERN = /^[a-z][a-z\d_]{2,119}$/u;

export const BROWSER_IMAGE_RENDER_MAX_ATTEMPTS = 3;

export class BrowserImageRenderError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "BrowserImageRenderError";
    this.code = code;
  }
}

export function browserImageFailureCode(error: unknown, fallback = "browser_image_render_failed") {
  const candidate = error instanceof BrowserImageRenderError
    ? error.code
    : error instanceof Error
      ? error.message
      : "";
  return BROWSER_IMAGE_ERROR_CODE_PATTERN.test(candidate) ? candidate : fallback;
}

type RetryBrowserImageOperationOptions = {
  failureCode: string;
  beforeAttempt?: () => Promise<void> | void;
  wait?: (milliseconds: number) => Promise<void>;
};

function waitForRetry(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function retryBrowserImageOperation<T>(operation: () => Promise<T>, {
  beforeAttempt,
  failureCode,
  wait = waitForRetry,
}: RetryBrowserImageOperationOptions): Promise<T> {
  for (let attempt = 0; attempt < BROWSER_IMAGE_RENDER_MAX_ATTEMPTS; attempt += 1) {
    try {
      await beforeAttempt?.();
      return await operation();
    } catch {
      if (attempt < BROWSER_IMAGE_RENDER_MAX_ATTEMPTS - 1) {
        await wait(attempt === 0 ? 350 : 900);
      }
    }
  }
  throw new BrowserImageRenderError(failureCode);
}
