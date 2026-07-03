self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? null;

  if (!payload?.title) {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: {
        targetUrl: payload.targetUrl,
        logId: payload.logId,
        openToken: payload.openToken,
      },
      tag: payload.tag,
      badge: "/android-chrome-192x192.png",
      icon: "/android-chrome-192x192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = withTrackingParams(
    event.notification?.data?.targetUrl,
    event.notification?.data?.logId,
    event.notification?.data?.openToken,
  );

  if (!targetUrl) {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        const target = new URL(targetUrl, self.location.origin);

        if (clientUrl.origin === target.origin) {
          return client.focus().then(() => client.navigate(target.toString()));
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});

function withTrackingParams(targetUrl, logId, openToken) {
  if (!targetUrl) {
    return null;
  }

  const url = new URL(targetUrl, self.location.origin);

  if (logId) {
    url.searchParams.set("pushLog", logId);
  }

  if (openToken) {
    url.searchParams.set("pushToken", openToken);
  }

  return url.toString();
}
