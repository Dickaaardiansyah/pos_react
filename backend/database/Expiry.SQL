-- ============================================================
-- Migration: Tanggal Kadaluarsa per Batch Barang Masuk
-- Jalankan setelah init.sql dan purchase.sql
--
--   • Menambahkan kolom expiry_date pada purchase_items agar setiap
--     batch "barang masuk" (satu baris pembelian) bisa punya tanggal
--     kadaluarsa sendiri — karena restock produk yang sama bisa punya
--     tanggal kadaluarsa berbeda-beda tiap kedatangan.
--   • Kolom ini opsional (nullable): produk yang tidak relevan dengan
--     kadaluarsa (mis. barang non-pangan) cukup dikosongkan.
--   • Dipakai oleh Laporan Barang Expired (Keuangan → Laporan).
-- ============================================================

USE pos_refactor;

-- Jika kolom sudah ada (mis. menjalankan ulang skrip ini), abaikan error
-- "Duplicate column name" yang muncul — itu artinya migrasi sudah pernah
-- dijalankan sebelumnya.
ALTER TABLE purchase_items
  ADD COLUMN expiry_date DATE NULL DEFAULT NULL
  COMMENT 'Tanggal kadaluarsa batch barang masuk ini (opsional)'
  AFTER quantity;

CREATE INDEX idx_purchase_items_expiry ON purchase_items(expiry_date);