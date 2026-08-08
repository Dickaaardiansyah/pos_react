-- database/product_units_price.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Harga jual per satuan (bukan cuma per konversi)
-- Jalankan setelah units_pricing.sql
--
-- Sebelum migration ini, `product_units` cuma menyimpan konversi (mis. 1 BOX
-- = 12 PCS) tapi TIDAK ada tempat menyimpan harga jual BOX itu sendiri —
-- padahal di referensi UX (form Barang & Jasa Accurate), setiap satuan
-- (PCS, BOX, dst.) punya kolom harga jual sendiri-sendiri, bukan cuma
-- konversi. Kasir jadinya tidak bisa jual per BOX dengan harga yang beda
-- dari sekadar (harga PCS × isi BOX).
--
-- Migration ini menambahkan:
--   • product_units.price            → harga jual eceran untuk satuan ini.
--   • product_units.price_wholesale  → harga jual grosir untuk satuan ini
--     (opsional; NULL berarti tidak ada harga grosir khusus utk satuan ini).
-- Satuan dasar produk tetap memakai products.price / products.price_wholesale
-- yang sudah ada — kolom baru ini hanya untuk satuan TAMBAHAN (BOX, LUSIN, dst).
-- ============================================================

USE pos_refactor;

ALTER TABLE product_units
  ADD COLUMN IF NOT EXISTS price DECIMAL(15,2) NULL
    COMMENT 'Harga jual eceran untuk satuan ini (mis. harga per BOX)'
    AFTER conversion_qty,
  ADD COLUMN IF NOT EXISTS price_wholesale DECIMAL(15,2) NULL
    COMMENT 'Harga jual grosir untuk satuan ini (opsional)'
    AFTER price;