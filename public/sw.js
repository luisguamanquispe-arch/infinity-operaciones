self.addEventListener("push", (event) => {
  let data = { title: "Infinity Operaciones", body: "Tiene una orden pendiente", url: "/tecnico/notificaciones" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload no JSON */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Infinity Operaciones", {
      body: data.body || "Tiene una orden pendiente",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/tecnico/notificaciones" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/tecnico/notificaciones";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
