-- ============================================================
-- Migration: Nota Supplier (upload bukti pembelian) + fix kolom
-- Jalankan sekali di MySQL/phpMyAdmin, SETELAH purchase.sql
-- ============================================================

USE pos_refactor;

-- Kolom untuk menyimpan path/URL file nota supplier (opsional).
-- nota_url menyimpan path relatif file (mis. /uploads/nota/xxx.jpg),
-- nota_original_name menyimpan nama file asli untuk ditampilkan ke user.
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS nota_url VARCHAR(500) DEFAULT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS nota_original_name VARCHAR(255) DEFAULT NULL AFTER nota_url;

-- Perbaikan: purchaseModel.js sudah menulis expiry_date ke purchase_items,
-- tapi kolomnya belum ada di skema awal (purchase.sql). Tambahkan di sini
-- supaya fitur tanggal kadaluarsa yang sudah ada di form tidak gagal saat submit.
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL AFTER quantity;