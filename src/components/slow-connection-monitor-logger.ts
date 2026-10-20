const LOG_PREFIX = "[FoxiesDeck slow-connection monitor]";

export function logSlowConnectionMonitorError(context: string, error: unknown, details?: unknown) {
  try {
    console.error(`${LOG_PREFIX} ${context}`, error, details ?? "");
  } catch {
    // Diagnostics must never be able to break the application shell.
  }
}

export function logSlowConnectionMonitorWarning(context: string, details?: unknown) {
  try {
    console.warn(`${LOG_PREFIX} ${context}`, details ?? "");
  } catch {
    // Diagnostics must never be able to break the application shell.
  }
}
