// backend/scripts/generate-vapid-keys.js
// ─────────────────────────────────────────────────────────────────────────────
// Jalankan sekali: `node scripts/generate-vapid-keys.js`
// Menghasilkan pasangan kunci VAPID (public/private) untuk Web Push.
// Salin hasilnya ke file .env (VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY) — JANGAN
// commit private key ke git. Public key aman dibagikan ke frontend.
// ─────────────────────────────────────────────────────────────────────────────
const webpush = require("web-push");

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(
  "\n✅ VAPID keys berhasil dibuat. Tambahkan baris berikut ke file .env:\n",
);
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@example.com\n`);
