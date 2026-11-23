"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import type {
  LeaderboardMode,
  LeaderboardPayload,
} from "@/features/leaderboard/leaderboard-types";
import {
  applyLeaderboardConsentTestMode,
  useLeaderboardConsentTestMode,
} from "@/features/leaderboard/leaderboard-consent-test-mode";
import { LEADERBOARD_REFRESH_EVENT } from "@/features/leaderboard/leaderboard-refresh";

type LeaderboardRequestState = {
  cacheKey: string;
  data: LeaderboardPayload | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
};

type LeaderboardRefreshSubscriber = (request: Promise<LeaderboardPayload>) => void;

type LeaderboardRefreshSubscribers = {
  mode: LeaderboardMode;
  callbacks: Set<LeaderboardRefreshSubscriber>;
};

type LeaderboardDataSubscriber = (payload: LeaderboardPayload) => void;

const leaderboardCache = new Map<string, LeaderboardPayload>();
const inFlightRequests = new Map<string, Promise<LeaderboardPayload>>();
const queuedRefreshes = new Map<string, Promise<LeaderboardPayload>>();
const refreshSubscribers = new Map<string, LeaderboardRefreshSubscribers>();
const dataSubscribers = new Map<string, Set<LeaderboardDataSubscriber>>();
let refreshEventListenerInstalled = false;

export function useLeaderboardData({
  enabled = true,
  refreshOnMount = false,
  mode = "points",
}: {
  enabled?: boolean;
  refreshOnMount?: boolean;
  mode?: LeaderboardMode;
} = {}) {
  const leaderboardConsentTestMode = useLeaderboardConsentTestMode();
  const { user } = useOptionalAuthSession() ?? { user: null };
  const cacheKey = getCacheKey(user?.id ?? null, mode);
  const cachedData = leaderboardCache.get(cacheKey) ?? null;
  const [requestState, setRequestState] = useState<LeaderboardRequestState>(() => ({
    cacheKey,
    data: cachedData,
    loading: enabled && !cachedData,
    refreshing: enabled && refreshOnMount,
    error: "",
  }));
  const visibleState = requestState.cacheKey === cacheKey
    ? requestState
    : {
        cacheKey,
        data: cachedData,
        loading: enabled && !cachedData,
        refreshing: enabled && refreshOnMount,
        error: "",
      };

  const fetchLeaderboard = useCallback(async ({
    showLoading,
    forceRefresh = false,
    request: sharedRequest,
  }: {
    showLoading: boolean;
    forceRefresh?: boolean;
    request?: Promise<LeaderboardPayload>;
  }) => {
    setRequestState((current) => {
      const currentState = current.cacheKey === cacheKey
        ? current
        : {
            cacheKey,
            data: leaderboardCache.get(cacheKey) ?? null,
            loading: enabled && !leaderboardCache.has(cacheKey),
            refreshing: false,
            error: "",
          };

      return {
        ...currentState,
        loading: showLoading ? true : currentState.loading,
        refreshing: true,
        error: "",
      };
    });

    try {
      const payload = await (
        sharedRequest ?? requestLeaderboard(cacheKey, mode, forceRefresh)
      );
      setRequestState((current) => current.cacheKey === cacheKey
        ? { ...current, data: payload, loading: false, refreshing: false, error: "" }
        : current);
    } catch {
      setRequestState((current) => current.cacheKey === cacheKey
        ? { ...current, loading: false, refreshing: false, error: "load_failed" }
        : current);
    }
  }, [cacheKey, enabled, mode]);

  const refresh = useCallback(async () => {
    await fetchLeaderboard({ showLoading: true, forceRefresh: true });
  }, [fetchLeaderboard]);

  useEffect(() => {
    const existingData = leaderboardCache.get(cacheKey) ?? null;
    if (
      !enabled ||
      (!refreshOnMount && existingData && !inFlightRequests.has(cacheKey))
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchLeaderboard({ showLoading: !existingData });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [cacheKey, enabled, fetchLeaderboard, refreshOnMount]);

  useEffect(() => {
    if (!enabled) return;

    return subscribeToLeaderboardData(cacheKey, (payload) => {
      setRequestState((current) => current.cacheKey === cacheKey
        ? { ...current, data: payload, loading: false, refreshing: false, error: "" }
        : current);
    });
  }, [cacheKey, enabled]);

  useEffect(() => {
    if (!enabled) return;

    return subscribeToLeaderboardRefresh(cacheKey, mode, (request) => {
      void fetchLeaderboard({ showLoading: false, request });
    });
  }, [cacheKey, enabled, fetchLeaderboard, mode]);

  const displayedData = useMemo(
    () => applyLeaderboardConsentTestMode(visibleState.data, leaderboardConsentTestMode),
    [visibleState.data, leaderboardConsentTestMode],
  );

  return {
    data: displayedData,
    loading: visibleState.loading,
    refreshing: visibleState.refreshing,
    error: visibleState.error,
    refresh,
  };
}

function getCacheKey(userId: string | null, mode: LeaderboardMode) {
  return `${userId ?? "anonymous"}:${mode}`;
}

function subscribeToLeaderboardRefresh(
  cacheKey: string,
  mode: LeaderboardMode,
  callback: LeaderboardRefreshSubscriber,
) {
  const subscribers = refreshSubscribers.get(cacheKey) ?? {
    mode,
    callbacks: new Set<LeaderboardRefreshSubscriber>(),
  };
  subscribers.callbacks.add(callback);
  refreshSubscribers.set(cacheKey, subscribers);

  if (!refreshEventListenerInstalled) {
    window.addEventListener(LEADERBOARD_REFRESH_EVENT, handleLeaderboardRefreshEvent);
    refreshEventListenerInstalled = true;
  }

  return () => {
    const currentSubscribers = refreshSubscribers.get(cacheKey);
    currentSubscribers?.callbacks.delete(callback);
    if (currentSubscribers?.callbacks.size === 0) {
      refreshSubscribers.delete(cacheKey);
    }

    if (refreshSubscribers.size === 0 && refreshEventListenerInstalled) {
      window.removeEventListener(LEADERBOARD_REFRESH_EVENT, handleLeaderboardRefreshEvent);
      refreshEventListenerInstalled = false;
    }
  };
}

function subscribeToLeaderboardData(
  cacheKey: string,
  callback: LeaderboardDataSubscriber,
) {
  const subscribers = dataSubscribers.get(cacheKey) ?? new Set<LeaderboardDataSubscriber>();
  subscribers.add(callback);
  dataSubscribers.set(cacheKey, subscribers);

  return () => {
    const currentSubscribers = dataSubscribers.get(cacheKey);
    currentSubscribers?.delete(callback);
    if (currentSubscribers?.size === 0) {
      dataSubscribers.delete(cacheKey);
    }
  };
}

function publishLeaderboardData(cacheKey: string, payload: LeaderboardPayload) {
  dataSubscribers.get(cacheKey)?.forEach((callback) => callback(payload));
}

function handleLeaderboardRefreshEvent() {
  refreshSubscribers.forEach(({ mode, callbacks }, cacheKey) => {
    leaderboardCache.delete(cacheKey);
    const request = requestLeaderboard(cacheKey, mode, true);
    callbacks.forEach((callback) => callback(request));
  });
}

function requestLeaderboard(
  cacheKey: string,
  mode: LeaderboardMode,
  forceRefresh: boolean,
): Promise<LeaderboardPayload> {
  const inFlightRequest = inFlightRequests.get(cacheKey);

  if (!forceRefresh && inFlightRequest) {
    return inFlightRequest;
  }

  if (forceRefresh && inFlightRequest) {
    const queuedRefresh = queuedRefreshes.get(cacheKey);
    if (queuedRefresh) return queuedRefresh;

    const refreshRequest = inFlightRequest
      .catch(() => undefined)
      .then(() => startLeaderboardRequest(cacheKey, mode));
    queuedRefreshes.set(cacheKey, refreshRequest);
    void refreshRequest.then(
      () => clearQueuedRefresh(cacheKey, refreshRequest),
      () => clearQueuedRefresh(cacheKey, refreshRequest),
    );
    return refreshRequest;
  }

  return startLeaderboardRequest(cacheKey, mode);
}

function startLeaderboardRequest(
  cacheKey: string,
  mode: LeaderboardMode,
): Promise<LeaderboardPayload> {
  const request = fetch(
    mode === "points" ? "/api/leaderboard" : `/api/leaderboard?mode=${mode}`,
    {
      credentials: "same-origin",
      cache: "no-store",
    },
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(`leaderboard_${response.status}`);
    }

    const payload = (await response.json()) as LeaderboardPayload;
    const normalizedPayload = { ...payload, mode: payload.mode ?? mode };
    leaderboardCache.set(cacheKey, normalizedPayload);
    publishLeaderboardData(cacheKey, normalizedPayload);
    return normalizedPayload;
  });

  inFlightRequests.set(cacheKey, request);
  void request.then(
    () => clearInFlightRequest(cacheKey, request),
    () => clearInFlightRequest(cacheKey, request),
  );
  return request;
}

function clearInFlightRequest(cacheKey: string, request: Promise<LeaderboardPayload>) {
  if (inFlightRequests.get(cacheKey) === request) {
    inFlightRequests.delete(cacheKey);
  }
}

function clearQueuedRefresh(cacheKey: string, request: Promise<LeaderboardPayload>) {
  if (queuedRefreshes.get(cacheKey) === request) {
    queuedRefreshes.delete(cacheKey);
  }
}
