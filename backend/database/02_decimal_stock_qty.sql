-- ============================================================
-- Migration: Tutup celah desimal yang terlewat di migration
-- 01_decimal_stock_qty.sql — purchase_items.previous_stock/new_stock
-- dan agregat stock_opname_sessions masih INT, padahal
-- purchase_items.quantity & stock_opname_items sudah DECIMAL.
-- Tanpa ini, pembelian/opname barang curah (mis. 0,5 kg) akan
-- terpotong/dibulatkan saat disimpan ke previous_stock/new_stock,
-- dan rekap selisih per sesi opname jadi tidak akurat.
-- Jalankan SETELAH 01_decimal_stock_qty.sql. Aman dijalankan ulang.
--
-- CATATAN: purchase.sql dan stock_opname.sql versi terbaru sudah
-- mendeklarasikan kolom-kolom ini sebagai DECIMAL(15,3) sejak awal.
-- Untuk INSTALASI BARU, migration ini TIDAK wajib dijalankan lagi
-- (aman/no-op jika dijalankan). Hanya wajib untuk meng-upgrade
-- database LAMA yang skemanya masih INT.
-- ============================================================

USE pos_refactor;

-- ─── purchase_items: previous_stock/new_stock ikut desimal ────
-- (quantity di tabel ini sudah DECIMAL(15,3) sejak migration 01,
-- tapi kolom snapshot stok sebelum/sesudah masih tertinggal INT)
ALTER TABLE purchase_items
  MODIFY COLUMN previous_stock DECIMAL(15,3) NOT NULL DEFAULT 0,
  MODIFY COLUMN new_stock      DECIMAL(15,3) NOT NULL DEFAULT 0;

-- ─── stock_opname_sessions: agregat per sesi ikut desimal ──────
-- (stock_opname_items.system_stock/physical_stock/difference sudah
-- DECIMAL sejak migration 01; total_difference_qty di header sesi
-- adalah SUM dari difference tsb, jadi ikut harus desimal supaya
-- tidak salah bulat saat ada produk curah dalam satu sesi opname)
ALTER TABLE stock_opname_sessions
  MODIFY COLUMN total_difference_qty DECIMAL(15,3) NOT NULL DEFAULT 0;