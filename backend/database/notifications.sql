-- database/notifications.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Notifikasi otomatis untuk stok habis, stok menipis (min_stock),
-- dan perlu reorder (Reorder Point). Jalankan setelah reorder_point.sql.
--
-- Notifikasi TIDAK dibuat oleh cron/scheduler terpisah — dibangkitkan secara
-- "lazy" setiap kali endpoint GET /notifications atau /notifications/unread-count
-- dipanggil (lihat notificationService.checkAndGenerate). Cukup untuk skala
-- satu toko dan tidak perlu proses background tambahan di server.
--
-- Satu baris = satu KEJADIAN notifikasi untuk satu produk+jenis. Baris LAMA
-- tidak dihapus saat kondisinya membaik (mis. sudah direstock) — cukup
-- ditandai is_resolved=1, supaya tetap muncul di riwayat. Kalau kondisi yang
-- sama terjadi LAGI di kemudian hari (mis. habis lagi), baris BARU dibuat.
--
-- type:
--   stock_out      → stok == 0 (paling kritis, prioritas di atas low_stock)
--   low_stock      → stok <= min_stock (dan stok > 0) — ambang manual per produk
--   reorder_point  → stok <= reorder_point hasil hitungan ROP (lead time & rata²
--                    penjualan) — metrik TERPISAH dari low_stock, tidak digabung
--                    (lihat catatan reviewer & productService.calculateReorderPoint)
-- ============================================================

USE pos_refactor;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('stock_out', 'low_stock', 'reorder_point') NOT NULL,
  level ENUM('critical', 'warning') NOT NULL DEFAULT 'warning',
  product_id INT UNSIGNED NULL,
  -- Nama produk disimpan langsung (bukan cuma JOIN ke products) supaya
  -- riwayat notifikasi tetap terbaca meski produk itu kemudian dihapus
  -- (soft delete / is_active=0) atau namanya diubah.
  product_name VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  is_resolved TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  -- Dipakai checkAndGenerate() untuk cek cepat "apakah produk ini sudah
  -- punya notifikasi jenis X yang masih aktif (belum resolved)?"
  INDEX idx_active_by_product (product_id, type, is_resolved),
  INDEX idx_unread (is_read, created_at),
  INDEX idx_created (created_at)
);
