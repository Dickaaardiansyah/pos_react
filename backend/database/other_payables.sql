-- database/other_payables.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Hutang Non-Supplier (Pinjaman Bank & Utang Lainnya) + perbaikan
-- jurnal hutang manual (supplier). Jalankan setelah init.sql, purchase.sql,
-- hutangpiutang.sql, dan journal.sql.
--
-- Lihat design/desain-hutang-non-supplier.md untuk penjelasan lengkap kenapa
-- migrasi ini dibuat.
--
-- Isi migrasi:
--   1. Akun (COA) baru:
--        2200 Utang Bank              (kewajiban)
--        2300 Utang Lainnya           (kewajiban, non-supplier non-bank)
--        5320 Beban Bunga Pinjaman    (beban)
--        3300 Saldo Awal / Penyesuaian (modal — lawan akun utk hutang manual
--             supplier yang TIDAK berasal dari modul Pembelian, supaya jurnal
--             tetap balance tanpa mengarang kenaikan stok/kas yang tidak nyata)
--   2. Tabel other_payables + other_payable_payments (pinjaman bank/lainnya,
--      dengan split pokok vs bunga saat bayar cicilan)
--   3. reference_type journal_entries → tambah 'payable_creation',
--      'other_payable' & 'other_payable_payment'
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

INSERT IGNORE INTO chart_of_accounts
  (account_code, account_name, account_type, normal_balance, description, is_system)
VALUES
  ('2200', 'Utang Bank', 'kewajiban', 'kredit',
   'Pokok pinjaman bank yang belum dilunasi', 1),
  ('2300', 'Utang Lainnya', 'kewajiban', 'kredit',
   'Kewajiban non-supplier & non-bank (mis. pinjaman pihak lain)', 1),
  ('5320', 'Beban Bunga Pinjaman', 'beban', 'debit',
   'Porsi bunga saat membayar cicilan pinjaman bank/lainnya', 1),
  ('3300', 'Saldo Awal / Penyesuaian', 'modal', 'kredit',
   'Lawan akun untuk entri hutang manual yang mengakui kondisi yang sudah ada (bukan transaksi baru), supaya jurnal tetap balance tanpa mengarang kenaikan stok/kas', 1);

CREATE TABLE IF NOT EXISTS other_payables (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code               VARCHAR(30)    NOT NULL UNIQUE,
  type               ENUM('pinjaman_bank','utang_lainnya') NOT NULL DEFAULT 'pinjaman_bank',
  creditor_name      VARCHAR(150)   NOT NULL,
  principal_amount   DECIMAL(15,2)  NOT NULL,
  outstanding_amount DECIMAL(15,2)  NOT NULL,
  interest_rate      DECIMAL(5,2)   DEFAULT NULL,
  disbursement_date  DATE           NOT NULL,
  due_date           DATE           NOT NULL,
  target_account     ENUM('kas','bank') NOT NULL DEFAULT 'bank',
  status             ENUM('aktif','lunas') NOT NULL DEFAULT 'aktif',
  notes              TEXT,
  recorded_by        VARCHAR(100)   DEFAULT '',
  created_at         DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS other_payable_payments (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  other_payable_id  INT UNSIGNED  NOT NULL,
  payment_date      DATE          NOT NULL,
  principal_amount  DECIMAL(15,2) NOT NULL DEFAULT 0,
  interest_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method    ENUM('cash','debit','qris','transfer') DEFAULT 'transfer',
  notes             TEXT,
  recorded_by       VARCHAR(100)  DEFAULT '',
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (other_payable_id) REFERENCES other_payables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_other_payables_status  ON other_payables(status);
CREATE INDEX idx_other_payables_due     ON other_payables(due_date);
CREATE INDEX idx_other_pay_payments_opb ON other_payable_payments(other_payable_id);

-- reference_type journal_entries: definisi LENGKAP & FINAL (MODIFY COLUMN
-- menimpa total definisi sebelumnya, lihat catatan di
-- journal_reference_type_fix.sql — migrasi ini harus jalan PALING TERAKHIR,
-- setelah journal_reference_type_fix.sql).
ALTER TABLE journal_entries
  MODIFY COLUMN reference_type
  ENUM(
    'sale',
    'purchase',
    'expense',
    'cash_movement',
    'cash_shift_close',
    'stock_opname',
    'capital',
    'receivable_payment',
    'payable_payment',
    'payable_creation',
    'other_payable',
    'other_payable_payment',
    'manual'
  )
  NOT NULL DEFAULT 'manual';