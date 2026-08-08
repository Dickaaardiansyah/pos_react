// frontend/src/features/notifications/push.js
// ─────────────────────────────────────────────────────────────────────────────
// Web Push — mendaftarkan Service Worker & mengelola subscription notifikasi
// browser (stok habis/menipis/reorder point), independen dari polling
// react-query di hooks.js. Push ini bekerja walau tab aplikasi tertutup,
// selama browser & OS-nya masih berjalan.
// ─────────────────────────────────────────────────────────────────────────────
import { httpClient } from "../../lib/httpClient";

export const pushApi = {
  publicKey: () => httpClient.get("/push/public-key"),
  subscribe: (subscription) => httpClient.post("/push/subscribe", subscription),
  unsubscribe: (endpoint) => httpClient.post("/push/unsubscribe", { endpoint }),
};

// applicationServerKey milik PushManager butuh Uint8Array, bukan string biasa
// — VAPID public key dari backend berbentuk base64url.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Menandai "otomasi sudah pernah dicoba" di perangkat ini — supaya kalau
// browser menampilkan prompt izin dan user menutup/menolaknya, aplikasi
// TIDAK terus-menerus memunculkan prompt yang sama di setiap reload
// (perilaku itu dianggap spam oleh browser & mengganggu user). Kalau user
// mau coba lagi, tombol manual di panel lonceng tetap tersedia kapan saja.
const AUTO_PROMPT_KEY = "pos_push_auto_prompted";

export function hasAutoPrompted() {
  try {
    return localStorage.getItem(AUTO_PROMPT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAutoPrompted() {
  try {
    localStorage.setItem(AUTO_PROMPT_KEY, "1");
  } catch {
    /* localStorage tidak tersedia (mis. mode privat ketat) — abaikan saja */
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error("Browser ini tidak mendukung notifikasi push");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.",
    );
  }

  const reg = await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Sudah subscribe di perangkat ini sebelumnya — pastikan backend tetap
    // punya salinannya (mis. setelah reset database) lalu selesai.
    await pushApi.subscribe(existing.toJSON());
    return existing;
  }

  const { data } = await pushApi.publicKey();
  if (!data?.publicKey) {
    throw new Error("Server belum dikonfigurasi untuk notifikasi push");
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });

  await pushApi.subscribe(subscription.toJSON());
  return subscription;
}

export async function unsubscribeFromPush() {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await pushApi.unsubscribe(subscription.endpoint).catch(() => {});
  await subscription.unsubscribe();
}
