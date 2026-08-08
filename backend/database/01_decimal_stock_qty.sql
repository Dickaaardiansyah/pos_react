-- ============================================================
-- Migration: Model B — stok & qty desimal + pastikan kolom opsi
-- Jalankan SETELAH init.sql, units_pricing.sql, product_options.sql
-- Aman dijalankan ulang (IF NOT EXISTS / MODIFY idempotent).
--
-- CATATAN: init.sql, purchase.sql, dan stock_opname.sql versi terbaru
-- sudah mendeklarasikan kolom stok/qty ini sebagai DECIMAL(15,3) sejak
-- awal. Untuk INSTALASI BARU, migration ini TIDAK wajib dijalankan lagi
-- (menjalankannya tetap aman/no-op karena idempotent). Migration ini
-- hanya wajib untuk meng-upgrade database LAMA yang skemanya masih INT.
-- ============================================================

USE pos_refactor;

-- ─── Stok & qty boleh pecahan (0.25 kg, 0.5 liter, dll.) ────
ALTER TABLE products
  MODIFY COLUMN stock     DECIMAL(15,3) NOT NULL DEFAULT 0,
  MODIFY COLUMN min_stock DECIMAL(15,3) NOT NULL DEFAULT 0;

ALTER TABLE transaction_items
  MODIFY COLUMN quantity DECIMAL(15,3) NOT NULL DEFAULT 1;

ALTER TABLE stock_history
  MODIFY COLUMN quantity       DECIMAL(15,3) NOT NULL,
  MODIFY COLUMN previous_stock DECIMAL(15,3) NOT NULL,
  MODIFY COLUMN new_stock      DECIMAL(15,3) NOT NULL;

-- Pembelian & opname ikut desimal supaya konsisten
ALTER TABLE purchase_items
  MODIFY COLUMN quantity DECIMAL(15,3) NOT NULL;

ALTER TABLE purchases
  MODIFY COLUMN total_qty DECIMAL(15,3) NOT NULL DEFAULT 0;

-- stock_opname_items (nama kolom mengikuti migration stock_opname.sql)
ALTER TABLE stock_opname_items
  MODIFY COLUMN system_stock   DECIMAL(15,3) NOT NULL,
  MODIFY COLUMN physical_stock DECIMAL(15,3) NOT NULL,
  MODIFY COLUMN difference     DECIMAL(15,3) NOT NULL;

-- Pastikan kolom opsi ada (jika product_options.sql belum dijalankan)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS selection_type ENUM('none','variant','unit') NOT NULL DEFAULT 'none'
    COMMENT 'none = langsung keranjang; variant = pilih varian; unit = pilih satuan'
    AFTER unit;

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS option_type ENUM('none','variant','unit') NOT NULL DEFAULT 'none'
    AFTER price_type,
  ADD COLUMN IF NOT EXISTS option_id INT UNSIGNED NULL
    AFTER option_type,
  ADD COLUMN IF NOT EXISTS option_label VARCHAR(100) NULL
    AFTER option_id,
  ADD COLUMN IF NOT EXISTS conversion_qty DECIMAL(15,4) NOT NULL DEFAULT 1
    AFTER option_label;

-- Seed satuan pecahan umum (abaikan jika sudah ada)
INSERT IGNORE INTO units (name) VALUES
  ('1/4 kg'), ('1/2 kg'), ('1/4 liter'), ('1/2 liter'), ('ons'), ('karung');