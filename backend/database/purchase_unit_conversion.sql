-- database/purchase_unit_conversion.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Konversi satuan beli (karung/kg/dll) untuk Pembelian
-- Jalankan setelah purchase.sql dan product_units_price.sql
--
-- Sebelum migration ini, purchase_items HANYA menyimpan quantity & unit_cost
-- dalam satuan dasar produk — konversi dari satuan beli (mis. Karung, Dus)
-- ke satuan dasar (mis. kg, pcs) dihitung SEPENUHNYA di frontend, lalu
-- angka yang sudah dikonversi itu langsung dikirim ke API. Backend tidak
-- pernah tahu satuan apa yang sebenarnya dipakai kasir/admin saat membeli,
-- dan tidak ada jejak audit untuk merekonstruksinya di kemudian hari
-- (beda dengan transaction_items yang sudah punya option_type/option_id/
-- option_label/conversion_qty sejak product_options.sql).
--
-- Migration ini menambahkan ke purchase_items:
--   • purchase_unit_id → ID product_units yang dipilih saat pembelian ini
--     (NULL = beli langsung dalam satuan dasar produk). TIDAK dibuat
--     FOREIGN KEY (mirror transaction_items.option_id) supaya baris lama
--     tetap valid & tidak ikut terhapus kalau satuan produk dihapus/diubah
--     di kemudian hari — nama satuan sudah di-snapshot di unit_label.
--   • unit_label       → snapshot nama satuan beli (mis. "Karung") untuk
--     nota/laporan, tetap akurat walau data product_units berubah nanti.
--   • conversion_qty   → 1 satuan beli ini = berapa satuan dasar (mis. 1
--     Karung = 25 kg). Default 1 supaya baris lama (sebelum migration ini)
--     tetap konsisten: quantity lama memang selalu sudah dalam satuan dasar.
--   • purchase_qty     → jumlah ASLI yang diinput kasir/admin dalam satuan
--     beli (mis. 2 Karung), sebelum dikonversi. Kolom `quantity` yang sudah
--     ada TETAP berisi hasil konversi ke satuan dasar (semantik lama tidak
--     berubah, supaya semua query laporan yang sudah ada tetap jalan).
-- ============================================================

USE pos_refactor;

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS purchase_unit_id INT UNSIGNED NULL
    COMMENT 'ID product_units yang dipilih saat pembelian ini (NULL = satuan dasar produk)'
    AFTER product_barcode,
  ADD COLUMN IF NOT EXISTS unit_label VARCHAR(100) NULL
    COMMENT 'Snapshot nama satuan beli (mis. "Karung"), tetap akurat walau satuan produk berubah/dihapus nanti'
    AFTER purchase_unit_id,
  ADD COLUMN IF NOT EXISTS conversion_qty DECIMAL(15,4) NOT NULL DEFAULT 1
    COMMENT '1 satuan beli ini = berapa satuan dasar (mis. 1 Karung = 25 kg)'
    AFTER unit_label,
  ADD COLUMN IF NOT EXISTS purchase_qty DECIMAL(15,3) NOT NULL DEFAULT 0
    COMMENT 'Jumlah asli yang diinput dalam satuan beli, sebelum dikonversi ke satuan dasar (kolom quantity)'
    AFTER conversion_qty;

-- Backfill baris lama: dulu selalu dianggap beli dalam satuan dasar,
-- jadi purchase_qty = quantity (satuan dasar) & conversion_qty = 1 (default).
UPDATE purchase_items
   SET purchase_qty = quantity
 WHERE purchase_qty = 0;