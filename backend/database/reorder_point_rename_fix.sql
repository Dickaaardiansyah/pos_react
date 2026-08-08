-- database/reorder_point_rename_fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- HANYA untuk database yang SUDAH pernah import versi LAMA reorder_point.sql
-- (kolom masih bernama lead_time_days & safety_stock_days, satuan hari saja).
--
-- Jalankan SEKALI SAJA, setelah itu database kamu sudah sinkron dengan kode
-- terbaru (yang mendukung satuan Hari ATAU Jam). Kalau kamu belum pernah
-- import reorder_point.sql sama sekali, JANGAN jalankan file ini — cukup
-- jalankan reorder_point.sql (versi terbaru) seperti biasa.
--
-- Yang dilakukan:
--   1. Rename lead_time_days    → lead_time_value    (data yang sudah diisi
--      TETAP ADA, cuma pindah nama kolom & satuannya otomatis dianggap
--      "hari" karena itu satu-satunya satuan yang ada di versi lama)
--   2. Rename safety_stock_days → safety_stock_value  (sama seperti di atas)
--   3. Tambah kolom rop_time_unit, default 'hari' untuk semua baris yang
--      sudah ada — konsisten dengan satuan yang dipakai versi lama
-- ============================================================

USE pos_refactor;

ALTER TABLE products
  CHANGE COLUMN lead_time_days    lead_time_value    DECIMAL(8,2) NULL
    COMMENT 'Rata-rata waktu tunggu pemesanan ke supplier sampai barang diterima, dalam satuan rop_time_unit. NULL = ROP tidak dihitung untuk produk ini.',
  CHANGE COLUMN safety_stock_days safety_stock_value DECIMAL(8,2) NULL
    COMMENT 'Cadangan (HC) dalam satuan rop_time_unit — dipakai menghitung Safety Stock.';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rop_time_unit ENUM('hari','jam') NOT NULL DEFAULT 'hari'
    COMMENT 'Satuan waktu untuk lead_time_value & safety_stock_value.'
    AFTER safety_stock_value;