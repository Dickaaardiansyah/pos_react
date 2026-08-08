-- database/push_subscriptions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Web Push subscriptions — dipakai untuk mengirim notifikasi
-- (stok habis / stok menipis / reorder point) langsung ke browser lewat
-- Service Worker, walaupun tab/aplikasi sedang tidak dibuka.
--
-- Satu baris = satu "langganan" push dari satu browser/perangkat. Satu user
-- bisa punya beberapa baris (login dari HP + laptop, dst). endpoint bersifat
-- unik per browser — kalau user subscribe ulang dari perangkat yang sama,
-- baris lama di-update (lihat pushSubscriptionModel.upsert), bukan didobel.
-- ============================================================

USE pos_refactor;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_endpoint (endpoint(255)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);