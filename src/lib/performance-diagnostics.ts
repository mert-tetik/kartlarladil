import {
  PERFORMANCE_DIAGNOSTICS_CONSENT_EVENT,
  PERFORMANCE_DIAGNOSTICS_ENDPOINT,
  PERFORMANCE_DIAGNOSTICS_QUEUE_PREFIX,
} from "@/lib/performance-diagnostics-contract";

export interface PerformanceDiagnosticDevice {
  manufacturer: string;
  model: string;
  android_release: string;
  android_api_level: number;
  app_version: string;
  webview_package: string;
  webview_version: string;
}

export interface PerformanceDiagnosticEvent {
  event_id: string;
  captured_at: string;
  device: PerformanceDiagnosticDevice;
  startup_ms?: number;
  startup_stage_ms?: Record<string, number>;
  navigation_ms?: number;
  navigation_route?: string;
  fps_average?: number;
  fps_duration_ms?: number;
  rendered_frames?: number;
  janky_frames?: number;
}

export interface PerformanceDiagnosticsConsent {
  enabled: boolean;
  has_decided: boolean;
  policy_version: string;
}

const consentRequests = new Map<string, Promise<PerformanceDiagnosticsConsent>>();

interface NativePerformanceSnapshot extends PerformanceDiagnosticEvent {
  owner_hash?: string;
}

interface NativePerformanceBridge {
  setPerformanceDiagnosticsContext?: (enabled: boolean, ownerHash: string) => void;
  getPerformanceDeviceInfo?: () => string;
  getPendingPerformanceSnapshots?: () => string;
  acknowledgePerformanceSnapshot?: (eventId: string) => void;
}

function getPerformanceBridge() {
  return (window as Window & { FoxiesDeckNativeLoading?: NativePerformanceBridge }).FoxiesDeckNativeLoading;
}

function createEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function queueStorageKey(userId: string) {
  return `${PERFORMANCE_DIAGNOSTICS_QUEUE_PREFIX}${userId}`;
}

export function getPerformanceDiagnosticsConsent(userId: string): Promise<PerformanceDiagnosticsConsent> {
  const pendingRequest = consentRequests.get(userId);
  if (pendingRequest) return pendingRequest;

  const request = fetch(PERFORMANCE_DIAGNOSTICS_ENDPOINT, {
    credentials: "same-origin",
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error("performance_diagnostics_consent_unavailable");
    return await response.json() as PerformanceDiagnosticsConsent;
  }).finally(() => {
    if (consentRequests.get(userId) === request) consentRequests.delete(userId);
  });

  consentRequests.set(userId, request);
  return request;
}

export function createPerformanceDiagnosticEvent(
  device: PerformanceDiagnosticDevice,
  metrics: Omit<PerformanceDiagnosticEvent, "event_id" | "captured_at" | "device">,
): PerformanceDiagnosticEvent {
  return {
    event_id: createEventId(),
    captured_at: new Date().toISOString(),
    device,
    ...metrics,
  };
}

export function readNativePerformanceDevice(): PerformanceDiagnosticDevice | null {
  try {
    const value = getPerformanceBridge()?.getPerformanceDeviceInfo?.();
    if (!value) return null;
    return JSON.parse(value) as PerformanceDiagnosticDevice;
  } catch {
    return null;
  }
}

export async function getNativePerformanceSnapshots(): Promise<NativePerformanceSnapshot[]> {
  const bridge = getPerformanceBridge();
  if (!bridge?.getPendingPerformanceSnapshots) return [];

  try {
    const raw = bridge.getPendingPerformanceSnapshots();
    const snapshots = JSON.parse(raw) as NativePerformanceSnapshot[];
    if (!Array.isArray(snapshots)) return [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return snapshots.slice(0, 8).filter((snapshot) => {
      const isFresh = Date.parse(snapshot.captured_at) >= cutoff;
      if (!isFresh && typeof snapshot.event_id === "string") {
        acknowledgeNativePerformanceSnapshot(snapshot.event_id);
      }
      return isFresh;
    });
  } catch {
    return [];
  }
}

export function acknowledgeNativePerformanceSnapshot(eventId: string) {
  try {
    getPerformanceBridge()?.acknowledgePerformanceSnapshot?.(eventId);
  } catch {
    // Native queue acknowledgment is best effort; event IDs make retry safe.
  }
}

export async function hashPerformanceOwner(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function setNativePerformanceConsent(enabled: boolean, ownerHash = "") {
  try {
    getPerformanceBridge()?.setPerformanceDiagnosticsContext?.(enabled, ownerHash);
  } catch {
    // Diagnostics must never interfere with the launch bridge.
  }
}

export function notifyPerformanceDiagnosticsConsentChanged(enabled: boolean, hasDecided = true) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PERFORMANCE_DIAGNOSTICS_CONSENT_EVENT, {
    detail: { enabled, has_decided: hasDecided },
  }));
}

export function readPendingPerformanceEvents(userId: string): PerformanceDiagnosticEvent[] {
  try {
    const key = queueStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) as PerformanceDiagnosticEvent[] : [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const fresh = Array.isArray(parsed)
      ? parsed.filter((event) => Date.parse(event.captured_at) >= cutoff).slice(-100)
      : [];
    if (!fresh.length) window.localStorage.removeItem(key);
    else if (fresh.length !== parsed.length) window.localStorage.setItem(key, JSON.stringify(fresh));
    return fresh;
  } catch {
    return [];
  }
}

export function enqueuePerformanceEvent(userId: string, event: PerformanceDiagnosticEvent) {
  const events = readPendingPerformanceEvents(userId);
  if (events.some((item) => item.event_id === event.event_id)) return;
  try {
    window.localStorage.setItem(queueStorageKey(userId), JSON.stringify([...events, event].slice(-100)));
  } catch {
    // Local storage is best-effort; a future measurement can still be sent.
  }
}

export function acknowledgePerformanceEvents(userId: string, eventIds: Set<string>) {
  try {
    const remaining = readPendingPerformanceEvents(userId).filter((event) => !eventIds.has(event.event_id));
    if (remaining.length) {
      window.localStorage.setItem(queueStorageKey(userId), JSON.stringify(remaining));
    } else {
      window.localStorage.removeItem(queueStorageKey(userId));
    }
  } catch {
    // A later retry is deduplicated by the server.
  }
}

export function clearPendingPerformanceEvents(userId: string) {
  try {
    window.localStorage.removeItem(queueStorageKey(userId));
  } catch {
    // Best effort privacy cleanup; server-side records are deleted by consent API.
  }
}

export async function flushPendingPerformanceEvents(userId: string): Promise<"sent" | "consent_required" | "failed"> {
  const events = readPendingPerformanceEvents(userId);
  if (!events.length) return "sent";

  try {
    const response = await fetch(PERFORMANCE_DIAGNOSTICS_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: events.slice(0, 20) }),
      keepalive: true,
    });
    if (response.status === 403) return "consent_required";
    if (!response.ok) return "failed";
    acknowledgePerformanceEvents(userId, new Set(events.slice(0, 20).map((event) => event.event_id)));
    return "sent";
  } catch {
    return "failed";
  }
}
