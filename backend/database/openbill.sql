-- database/migration_open_bill.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Alur "Open Bill" langsung dari Kasir
-- Jalankan setelah init.sql, customer.sql, hutangpiutang.sql, dan journal.sql
--
-- Sebelumnya, Piutang hanya bisa dicatat manual dan terpisah dari transaksi
-- Kasir. Migration ini menyambungkan alur:
--   Kasir pilih "Open Bill" → pilih pelanggan → transaksi tersimpan, stok
--   berkurang → faktur otomatis masuk ke daftar Open Bill (Piutang).
--
-- Perubahan:
--   • transactions.payment_method  → tambah opsi 'open_bill'
--   • transactions.customer_id     → tautan opsional ke customers (FK)
--   • chart_of_accounts            → akun baru "Piutang Usaha" (1300)
--   • journal_entries.reference_type → tambah 'receivable_payment', supaya
--     pembayaran cicilan Open Bill juga otomatis posting jurnal
--     (Debit Kas/Bank, Kredit Piutang Usaha)
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

ALTER TABLE transactions
  MODIFY COLUMN payment_method
  ENUM('cash','debit','qris','transfer','open_bill')
  DEFAULT 'cash';

ALTER TABLE transactions
  ADD COLUMN customer_id INT UNSIGNED DEFAULT NULL AFTER customer_name,
  ADD CONSTRAINT fk_transactions_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_customer ON transactions(customer_id);

INSERT IGNORE INTO chart_of_accounts
  (account_code, account_name, account_type, normal_balance, description, is_system)
VALUES
  ('1300', 'Piutang Usaha', 'aset', 'debit',
   'Tagihan ke pelanggan dari transaksi Open Bill (belum dibayar/dicicil)', 1);

ALTER TABLE journal_entries
  MODIFY COLUMN reference_type
  ENUM('sale','purchase','expense','cash_movement','cash_shift_close','stock_opname','capital','receivable_payment','manual')
  NOT NULL DEFAULT 'manual';