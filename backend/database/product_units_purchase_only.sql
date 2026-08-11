-- database/product_units_purchase_only.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Satuan khusus Pembelian (bukan untuk dijual ke kasir)
-- Jalankan setelah product_units_price.sql
--
-- Konteks: form Tambah Barang sekarang bisa menghitung Modal otomatis dari
-- "Harga Beli ÷ Isi" (mis. Beras: Rp300.000/Karung ÷ 25 Kg = Rp12.000/Kg).
-- Baris konversi "Karung" itu disimpan sebagai product_units biasa supaya
-- otomatis muncul lagi di dropdown "Satuan Beli" pada form Pembelian.
--
-- Masalahnya: product_units yang sudah ada dipakai DUA fungsi sekaligus —
-- (1) konversi satuan beli, dan (2) opsi satuan yang bisa dibeli kasir
-- (lihat product_options.sql, selection_type='unit'). Kalau tokonya cuma
-- beli dalam satuan besar tapi TIDAK menjual dalam satuan besar itu (mis.
-- tidak jual beras per karung, cuma per kg), baris "Karung" ini seharusnya
-- disembunyikan dari popup kasir walau tetap ada di product_units untuk
-- keperluan konversi Pembelian.
--
-- Migration ini menambahkan:
--   • product_units.purchase_only → TRUE = satuan ini cuma untuk konversi
--     Pembelian, JANGAN ditawarkan sebagai opsi beli di kasir. Default
--     FALSE supaya semua baris lama (dan satuan tambahan yang memang
--     sengaja dijual, mis. BOX/LUSIN) tidak berubah perilaku.
-- ============================================================

USE pos_refactor;

ALTER TABLE product_units
  ADD COLUMN IF NOT EXISTS purchase_only TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'TRUE = satuan ini hanya untuk konversi Pembelian, disembunyikan dari opsi satuan di kasir'
    AFTER price_wholesale;