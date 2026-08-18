-- database/cash_shift_link_transactions.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FIX (revisi dosen #17): Perhitungan tutup kas sengaja mengabaikan transaksi
-- kas lain yang SAMA-SAMA menyentuh laci kasir fisik (bukan cuma akun Kas di
-- pembukuan): pembayaran piutang tunai, pembayaran hutang tunai, pembelian
-- tunai, setoran/prive modal tunai, dan biaya operasional.
--
-- Sebelumnya modul Kas Kecil (cash_shifts/cash_movements) HANYA tahu soal
-- penjualan tunai (transactions) + pergerakan manual (cash_movements). Kelima
-- jenis transaksi di atas diposting ke akun Kas (1100) lewat jurnal, tapi
-- TIDAK PERNAH tersambung ke sesi kas mana pun — sehingga saat tutup kas,
-- "saldo seharusnya" versi sistem tidak realistis kalau transaksi2 itu di
-- praktiknya dibayar/diterima dari laci fisik yang sama.
--
-- Fix: tambahkan kolom shift_id (nullable) ke tabel-tabel terkait, diisi
-- HANYA kalau pembayarannya benar2 tunai/kas (bukan bank/transfer/qris/debit)
-- DAN ada sesi kas yang sedang terbuka saat transaksi dicatat (kalau tidak
-- ada sesi terbuka, dianggap tidak melalui laci kasir manapun -> NULL, tidak
-- masuk hitungan tutup kas manapun, sama seperti transaksi lama sebelum
-- migration ini).
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: skrip ini idempotent untuk kolomnya (ADD COLUMN IF NOT EXISTS), tapi
-- constraint FOREIGN KEY di MySQL tidak mendukung "IF NOT EXISTS" — kalau
-- migration ini pernah dijalankan sebagian dan diulang, hapus dulu FK yang
-- relevan (SHOW CREATE TABLE <tabel> untuk lihat nama constraint-nya) sebelum
-- menjalankan ulang blok ALTER TABLE ... ADD CONSTRAINT di bawah.

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Sesi kas aktif saat pembelian TUNAI ini dicatat (NULL jika kredit atau tidak ada sesi kas terbuka)'
    AFTER payment_method;
ALTER TABLE purchases
  ADD CONSTRAINT fk_purchases_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

ALTER TABLE payable_payments
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Sesi kas aktif saat pembayaran hutang CASH ini dicatat (NULL jika non-cash atau tidak ada sesi kas terbuka)'
    AFTER payment_method;
ALTER TABLE payable_payments
  ADD CONSTRAINT fk_payable_payments_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

ALTER TABLE receivable_payments
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Sesi kas aktif saat pembayaran piutang CASH ini diterima (NULL jika non-cash atau tidak ada sesi kas terbuka)'
    AFTER payment_method;
ALTER TABLE receivable_payments
  ADD CONSTRAINT fk_receivable_payments_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

ALTER TABLE capital_transactions
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Sesi kas aktif saat setoran/prive lewat KAS ini dicatat (NULL jika target_account=bank atau tidak ada sesi kas terbuka)'
    AFTER target_account;
ALTER TABLE capital_transactions
  ADD CONSTRAINT fk_capital_transactions_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Sesi kas aktif saat biaya operasional ini dibayar (selalu dari Kas — NULL hanya kalau tidak ada sesi kas terbuka)'
    AFTER amount;
ALTER TABLE expenses
  ADD CONSTRAINT fk_expenses_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_shift            ON purchases(shift_id);
CREATE INDEX IF NOT EXISTS idx_payable_payments_shift      ON payable_payments(shift_id);
CREATE INDEX IF NOT EXISTS idx_receivable_payments_shift   ON receivable_payments(shift_id);
CREATE INDEX IF NOT EXISTS idx_capital_transactions_shift  ON capital_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shift               ON expenses(shift_id);

-- Snapshot 5 total baru pada cash_shifts, disimpan saat tutup kas — mirror
-- pola total_cash_sales/total_cash_in/total_cash_out yang sudah ada, supaya
-- histori tutup kas tetap bisa dibaca ulang tanpa menghitung ulang dari
-- tabel-tabel sumber (yang datanya terus berubah seiring waktu).
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS total_cash_receivable DECIMAL(15,2) DEFAULT NULL
    COMMENT 'Snapshot: pembayaran piutang tunai yang masuk ke laci selama shift' AFTER total_cash_out,
  ADD COLUMN IF NOT EXISTS total_cash_payable     DECIMAL(15,2) DEFAULT NULL
    COMMENT 'Snapshot: pembayaran hutang tunai yang keluar dari laci selama shift' AFTER total_cash_receivable,
  ADD COLUMN IF NOT EXISTS total_cash_purchase    DECIMAL(15,2) DEFAULT NULL
    COMMENT 'Snapshot: pembelian tunai yang keluar dari laci selama shift' AFTER total_cash_payable,
  ADD COLUMN IF NOT EXISTS total_cash_capital_in  DECIMAL(15,2) DEFAULT NULL
    COMMENT 'Snapshot: setoran modal tunai yang masuk ke laci selama shift' AFTER total_cash_purchase,
  ADD COLUMN IF NOT EXISTS total_cash_capital_out DECIMAL(15,2) DEFAULT NULL
    COMMENT 'Snapshot: penarikan modal (prive) tunai yang keluar dari laci selama shift' AFTER total_cash_capital_in,
  ADD COLUMN IF NOT EXISTS total_cash_expense     DECIMAL(15,2) DEFAULT NULL
    COMMENT 'Snapshot: biaya operasional tunai yang keluar dari laci selama shift' AFTER total_cash_capital_out;