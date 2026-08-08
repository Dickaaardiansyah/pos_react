// frontend/public/sw.js
// ─────────────────────────────────────────────────────────────────────────────
// Service Worker — menangani notifikasi push (stok habis/menipis/reorder
// point) dari backend, termasuk saat tab aplikasi sedang tidak dibuka.
// Tidak melakukan caching apa pun (bukan PWA offline-first) — satu-satunya
// tugasnya menampilkan notifikasi & mengarahkan klik ke halaman yang tepat.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  // Langsung aktif tanpa menunggu tab lama ditutup — versi SW baru (kalau
  // ada perubahan file ini) segera dipakai.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "kasiQu", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "kasiQu";
  const options = {
    body: data.body || "",
    icon: "/vite.svg",
    badge: "/vite.svg",
    // tag + renotify: notifikasi jenis yang sama (mis. stock_out berulang)
    // akan MENGGANTI notifikasi lama di tray, bukan menumpuk.
    tag: data.tag || "pos-notification",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        // Kalau ada tab aplikasi yang sudah terbuka, fokuskan & navigasi ke
        // situ — jangan buka tab baru kalau tidak perlu.
        const existing = clientsArr.find((c) =>
          c.url.includes(self.location.origin),
        );
        if (existing) {
          existing.navigate(targetPath);
          return existing.focus();
        }
        return self.clients.openWindow(targetPath);
      }),
  );
});
