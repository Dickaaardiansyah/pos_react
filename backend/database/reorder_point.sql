-- database/reorder_point.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Reorder Point (ROP) — titik pemesanan ulang otomatis
-- Jalankan setelah init.sql
--
-- Menambahkan tiga kolom opsional pada products:
--   • lead_time_value     → rata-rata waktu tunggu dari pemesanan ke supplier
--     sampai barang diterima toko (LT), dalam satuan yang dipilih di
--     rop_time_unit (hari ATAU jam).
--   • safety_stock_value  → cadangan (HC) yang diinginkan admin untuk
--     mengantisipasi lonjakan permintaan/keterlambatan supplier, dalam
--     satuan yang sama dengan lead_time_value.
--   • rop_time_unit        → menentukan apakah dua kolom di atas dihitung
--     dalam satuan 'hari' (default) atau 'jam'.
--
-- lead_time_value & safety_stock_value NULL secara default (bukan 0) — NULL
-- artinya "belum diatur", sehingga ROP TIDAK dihitung untuk produk tsb (beda
-- makna dengan 0 yang berarti admin sengaja set lead time/cadangan = 0).
--
-- Rumus yang dipakai (lihat productService — calculateReorderPoint):
--
--   Versi HARI (rop_time_unit = 'hari'):
--     d   = rata-rata penjualan harian (satuan dasar)
--     SS  = HC(hari) x d
--     ROP = (d x LT(hari)) + SS
--
--   Versi JAM (rop_time_unit = 'jam'):
--     d_jam = rata-rata penjualan harian / jam operasional toko per hari
--             (jam operasional diatur di halaman Pengaturan, key
--             'store_operating_hours', default 10 jam kalau belum diisi)
--     SS    = HC(jam) x d_jam
--     ROP   = (d_jam x LT(jam)) + SS
-- ============================================================

USE pos_refactor;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS lead_time_value DECIMAL(8,2) NULL
    COMMENT 'Rata-rata waktu tunggu pemesanan ke supplier sampai barang diterima, dalam satuan rop_time_unit. NULL = ROP tidak dihitung untuk produk ini.'
    AFTER min_stock,
  ADD COLUMN IF NOT EXISTS safety_stock_value DECIMAL(8,2) NULL
    COMMENT 'Cadangan (HC) dalam satuan rop_time_unit — dipakai menghitung Safety Stock.'
    AFTER lead_time_value,
  ADD COLUMN IF NOT EXISTS rop_time_unit ENUM('hari','jam') NOT NULL DEFAULT 'hari'
    COMMENT 'Satuan waktu untuk lead_time_value & safety_stock_value.'
    AFTER safety_stock_value;