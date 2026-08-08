-- ============================================================
-- Migration: Modul Akuntansi — Biaya Operasional & Laba Rugi
-- Jalankan setelah init.sql dan purchase.sql
-- ============================================================

USE pos_refactor;

-- Tabel biaya operasional (operating expenses) — dasar perhitungan Laba Rugi
CREATE TABLE IF NOT EXISTS expenses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expense_date  DATE           NOT NULL,
  category      VARCHAR(50)    NOT NULL,
  description   VARCHAR(255)   DEFAULT '',
  amount        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  recorded_by   VARCHAR(100)   DEFAULT '',
  created_at    DATETIME       DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Jika database dibuat dari versi sebelum refactor ini (tanpa kolom unit_cost
-- pada transaction_items), jalankan ALTER berikut secara manual:
--
--   ALTER TABLE transaction_items
--     ADD COLUMN unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0
--     COMMENT 'Snapshot harga modal saat transaksi' AFTER unit_price;
--
-- Baris transaksi lama yang belum punya snapshot unit_cost akan terhitung
-- HPP = 0 pada laporan Laba Rugi periode sebelum migrasi ini dijalankan.

-- Contoh data biaya operasional bulan berjalan (opsional, hapus jika tidak perlu)
INSERT INTO expenses (expense_date, category, description, amount, recorded_by) VALUES
(CURDATE(), 'sewa',        'Sewa toko bulan berjalan',         2500000, 'Admin'),
(CURDATE(), 'listrik_air', 'Tagihan listrik & air',              450000, 'Admin'),
(CURDATE(), 'gaji',        'Gaji karyawan',                    3000000, 'Admin');
