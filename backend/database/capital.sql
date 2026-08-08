-- database/capital.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Modul Modal Usaha (Owner's Capital)
-- Jalankan setelah init.sql dan journal.sql
--
-- Selama ini pergerakan uang (kas, pembelian, penjualan, biaya) tidak
-- dibandingkan dengan modal awal usaha, sehingga tidak diketahui apakah
-- ekuitas usaha bertambah atau berkurang. Modul ini menambahkan:
--   • capital_transactions → riwayat setoran modal (termasuk MODAL AWAL,
--     hanya boleh satu) dan penarikan modal (prive) oleh pemilik.
--   • reference_type 'capital' pada journal_entries, supaya tiap transaksi
--     modal otomatis memicu jurnal double-entry:
--       - Setoran  → Debit Kas/Bank,        Kredit Modal Pemilik (3100)
--       - Penarikan→ Debit Prive (3200),    Kredit Kas/Bank
--
-- Dengan ini, Neraca Saldo (journalService.trialBalance) sudah otomatis
-- "nyambung" dengan pembelian, penjualan, biaya, dan kas kecil — karena
-- seluruhnya sama-sama posting ke buku besar. Modal Awal hanya dipakai
-- sebagai titik pembanding (baseline) untuk menghitung kenaikan/penurunan
-- ekuitas usaha (lihat services/capitalService.js → summary()).
-- ============================================================

USE pos_refactor;

-- Tambahkan 'capital' ke enum reference_type jurnal (aman dijalankan ulang
-- karena MODIFY COLUMN bersifat idempotent untuk definisi yang sama).
ALTER TABLE journal_entries
  MODIFY COLUMN reference_type
  ENUM('sale','purchase','expense','cash_movement','cash_shift_close','stock_opname','capital','manual')
  NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS capital_transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(30)   NOT NULL UNIQUE,
  transaction_date DATE          NOT NULL,
  type             ENUM('setoran','penarikan') NOT NULL,
  is_initial       TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1 = Modal Awal usaha, hanya boleh ada 1 baris dengan nilai ini (divalidasi di service layer)',
  target_account   ENUM('kas','bank') NOT NULL DEFAULT 'kas',
  amount           DECIMAL(15,2) NOT NULL DEFAULT 0,
  description      VARCHAR(255)  DEFAULT '',
  recorded_by      VARCHAR(100)  DEFAULT '',
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_capital_date ON capital_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_capital_type ON capital_transactions(type);