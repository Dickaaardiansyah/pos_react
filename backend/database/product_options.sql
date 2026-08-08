-- database/product_options.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Product Options dinamis (none / variant / unit)
-- Jalankan setelah wholesale_min_qty.sql
--
-- Menambahkan:
--   • products.selection_type   → menentukan perilaku kasir saat produk
--     diklik: 'none' (langsung masuk keranjang), 'variant' (popup pilih
--     varian, mis. Es/Panas/Freeze), 'unit' (popup pilih satuan, mis.
--     Karung/Kg — pakai data product_units yang sudah ada).
--   • product_units.barcode/sku → tiap satuan tambahan boleh punya barcode
--     & SKU sendiri (opsional), supaya scan barcode di kasir bisa langsung
--     kena ke satuan yang tepat (mis. barcode beda untuk DUS vs PCS).
--   • product_variants          → master data varian per produk (Es, Panas,
--     dst.), masing-masing dengan harga sendiri (eceran/grosir) + barcode/
--     SKU opsional. Murni data buatan admin, tidak ada nama varian yang
--     di-hardcode di source code.
--   • transaction_items         → mencatat opsi apa yang benar-benar dibeli
--     (none/variant/unit + id + label snapshot) dan conversion_qty yang
--     dipakai saat itu, supaya struk & laporan tetap akurat walau opsi
--     produk berubah/dihapus di kemudian hari.
-- ============================================================

USE pos_refactor;

-- ─── PRODUCTS: jenis pilihan ────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS selection_type ENUM('none','variant','unit') NOT NULL DEFAULT 'none'
    COMMENT 'none = langsung masuk keranjang; variant = popup pilih varian; unit = popup pilih satuan'
    AFTER unit;

-- ─── PRODUCT_UNITS: barcode & SKU opsional per satuan ───────
ALTER TABLE product_units
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(50) NULL COMMENT 'Barcode khusus satuan ini (opsional)' AFTER min_qty_wholesale,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(50) NULL COMMENT 'SKU khusus satuan ini (opsional)' AFTER barcode,
  ADD UNIQUE KEY IF NOT EXISTS uniq_product_units_barcode (barcode);

-- ─── PRODUCT_VARIANTS: varian per produk (Es, Panas, dst.) ──
CREATE TABLE IF NOT EXISTS product_variants (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id        INT UNSIGNED NOT NULL,
  name              VARCHAR(100) NOT NULL COMMENT 'Nama varian, bebas ditentukan admin (Es, Panas, Freeze, dst.)',
  price             DECIMAL(15,2) NOT NULL COMMENT 'Harga eceran varian ini',
  price_wholesale   DECIMAL(15,2) NULL COMMENT 'Harga grosir varian ini (opsional)',
  min_qty_wholesale INT UNSIGNED NULL COMMENT 'Jumlah beli minimum agar harga grosir varian ini berlaku',
  barcode           VARCHAR(50) NULL COMMENT 'Barcode khusus varian ini (opsional)',
  sku               VARCHAR(50) NULL COMMENT 'SKU khusus varian ini (opsional)',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_variant_name (product_id, name),
  UNIQUE KEY uniq_product_variants_barcode (barcode),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── TRANSACTION_ITEMS: snapshot opsi yang terjual ──────────
-- conversion_qty default 1 supaya baris lama (sebelum migration ini) tetap
-- konsisten: quantity lama memang selalu dalam satuan dasar (1 qty = 1
-- satuan dasar).
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS option_type ENUM('none','variant','unit') NOT NULL DEFAULT 'none'
    COMMENT 'Jenis opsi yang dipilih kasir saat menjual item ini' AFTER price_type,
  ADD COLUMN IF NOT EXISTS option_id INT UNSIGNED NULL
    COMMENT 'ID product_variants atau product_units yang dipilih (NULL jika none/satuan dasar)' AFTER option_type,
  ADD COLUMN IF NOT EXISTS option_label VARCHAR(100) NULL
    COMMENT 'Snapshot nama opsi (mis. "Es", "Karung") untuk struk & laporan' AFTER option_id,
  ADD COLUMN IF NOT EXISTS conversion_qty DECIMAL(15,4) NOT NULL DEFAULT 1
    COMMENT 'Berapa satuan dasar per 1 qty baris ini; dipakai untuk hitung pengurangan stok' AFTER option_label;