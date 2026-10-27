// Service Worker for OBEXA Wholesale PWA
const CACHE_NAME = "obexa-wholesale-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("push", (event) => {
  if (event.data) {
    try {
      const payload = event.data.json();
      const title = payload.title || "OBEXA Wholesale";
      const options = {
        body: payload.body || "New update from administration",
        icon: payload.icon || "/apple-touch-icon.png",
        badge: "/apple-touch-icon.png",
        vibrate: [120, 60, 120],
        data: {
          url: payload.url || "/",
          timestamp: Date.now(),
        },
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("IQ TROUSERS Wholesale", {
          body: text,
          icon: "/apple-touch-icon.png",
        })
      );
    }
  }
});
