-- database/units_pricing.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Satuan (Units) master data + Harga Grosir/Eceran
-- Jalankan setelah init.sql
--
-- Selama ini field `unit` pada produk adalah teks bebas (rawan salah ketik/
-- duplikat seperti "PCS" vs "pcs" vs "Pcs"), dan hanya ada satu harga jual.
-- Migration ini menambahkan:
--   • units                → master data satuan (dipakai lewat kombobox
--     "cari atau buat baru" di form Produk & Kategori, lihat referensi UX
--     yang diberikan pengguna).
--   • products.price_wholesale → harga grosir, terpisah dari `price` (harga
--     eceran). Kasir memilih manual jenis harga saat transaksi kasir.
--   • product_units         → satuan tambahan per produk beserta faktor
--     konversi ke satuan dasar produk (kolom `unit` yang sudah ada), mis.
--     1 BOX = 12 PCS, 1 Renceng = 10 PCS.
--   • transaction_items.price_type → mencatat jenis harga (grosir/eceran)
--     yang dipakai saat item itu terjual, untuk keperluan laporan.
-- ============================================================

USE pos_refactor;

-- ─── UNITS (satuan) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed dari nilai `unit` teks bebas yang sudah dipakai produk, supaya data
-- lama tetap konsisten begitu form produk beralih ke kombobox satuan.
INSERT IGNORE INTO units (name)
  SELECT DISTINCT TRIM(unit) FROM products
  WHERE unit IS NOT NULL AND TRIM(unit) <> '';

-- Beberapa satuan umum toko kelontong/grosir, biar kombobox tidak kosong
-- pada instalasi baru.
INSERT IGNORE INTO units (name) VALUES
  ('pcs'), ('box'), ('lusin'), ('renceng'), ('pack'), ('dus'),
  ('kg'), ('gram'), ('liter'), ('botol'), ('karton'), ('sak');

-- ─── PRODUCTS: harga grosir ─────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_wholesale DECIMAL(15,2) NULL
    COMMENT 'Harga grosir (opsional). Jika NULL/0, transaksi grosir jatuh ke harga eceran (price).'
    AFTER price;

-- ─── PRODUCT_UNITS: satuan tambahan + konversi ─────────────
-- Konversi dihitung terhadap satuan dasar produk (kolom products.unit).
-- Contoh: produk dasar "PCS", lalu ditambahkan BOX dengan conversion_qty=12
-- artinya 1 BOX = 12 PCS.
CREATE TABLE IF NOT EXISTS product_units (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      INT UNSIGNED NOT NULL,
  unit_id         INT UNSIGNED NOT NULL,
  conversion_qty  DECIMAL(15,4) NOT NULL COMMENT '1 satuan ini = berapa satuan dasar produk',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_unit (product_id, unit_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id)    REFERENCES units(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── TRANSACTION_ITEMS: jenis harga yang dipakai ───────────
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS price_type ENUM('retail','wholesale') NOT NULL DEFAULT 'retail'
    COMMENT 'Jenis harga yang dipakai saat penjualan: eceran atau grosir'
    AFTER unit_price;