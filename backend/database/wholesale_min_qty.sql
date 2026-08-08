-- database/wholesale_min_qty.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Jumlah beli minimum untuk harga grosir
-- Jalankan setelah units_pricing.sql dan product_units_price.sql
--
-- Sebelumnya harga grosir (products.price_wholesale, product_units.price_wholesale)
-- cuma berupa angka harga tanpa syarat jumlah beli — kasir memilih grosir/eceran
-- manual tanpa aturan yang jelas kapan harga grosir seharusnya berlaku. Ini
-- menambahkan kolom `min_qty_wholesale` di kedua tabel supaya setiap harga
-- grosir punya syarat "beli minimal berapa" (mis. harga grosir berlaku kalau
-- beli >= 6 pcs), sejalan dengan referensi UX form Barang & Jasa.
-- ============================================================

USE pos_refactor;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_qty_wholesale INT UNSIGNED NULL
    COMMENT 'Jumlah beli minimum (satuan dasar) agar harga grosir berlaku'
    AFTER price_wholesale;

ALTER TABLE product_units
  ADD COLUMN IF NOT EXISTS min_qty_wholesale INT UNSIGNED NULL
    COMMENT 'Jumlah beli minimum satuan ini agar harga grosir satuan ini berlaku'
    AFTER price_wholesale;