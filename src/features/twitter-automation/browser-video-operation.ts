export function awaitBrowserVideoOperation<T>(operation: Promise<T> | (() => Promise<T>), signal?: AbortSignal) {
  if (!signal) return typeof operation === "function" ? operation() : operation;
  if (signal.aborted) return Promise.reject(new Error("browser_video_render_timeout"));

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(new Error("browser_video_render_timeout"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }

    let pendingOperation: Promise<T>;
    try {
      pendingOperation = typeof operation === "function" ? operation() : operation;
    } catch (error) {
      cleanup();
      reject(error);
      return;
    }

    void pendingOperation.then((value) => {
      cleanup();
      resolve(value);
    }, (error: unknown) => {
      cleanup();
      reject(error);
    });
  });
}
