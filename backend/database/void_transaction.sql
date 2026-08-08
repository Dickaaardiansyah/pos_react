-- database/void_transaction.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Batal (Void) Transaksi Penjualan
-- Jalankan setelah init.sql, journal.sql, openbill.sql, hutangpiutang.sql,
-- dan journal_reference_type_fix.sql (kalau sudah ada). Aman dijalankan
-- berkali-kali dan tidak bergantung urutan file migrasi lama lainnya.
--
-- Selama ini transactions.status punya value 'cancelled', tapi tidak ada
-- alur aplikasi yang pernah men-set-nya — satu-satunya cara kasir/admin
-- "membatalkan" transaksi adalah edit manual langsung ke database (jurnal
-- koreksi + adjustment stok manual), yang rawan mismatch. Migration ini
-- menyiapkan kolom & value yang dibutuhkan alur void resmi lewat aplikasi
-- (lihat services/journalService.postVoidSaleJournal &
-- models/transactionModel.voidTransaction):
--   • transactions            → kolom jejak audit pembatalan (siapa, kapan,
--     alasan apa)
--   • journal_entries.reference_type → tambah 'void' untuk jurnal koreksi
--     pembalik (jurnal penjualan ASLI tidak dihapus/diubah — tetap sebagai
--     jejak audit; void hanya menambah entri baru yang membalikkannya)
--   • receivables.status      → tambah 'dibatalkan', dipakai saat transaksi
--     Open Bill yang di-void juga membatalkan piutangnya
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

-- ─── TRANSACTIONS: jejak audit pembatalan ──────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voided_at DATETIME NULL
    COMMENT 'Waktu transaksi dibatalkan (NULL jika belum pernah dibatalkan)'
    AFTER status,
  ADD COLUMN IF NOT EXISTS voided_by VARCHAR(100) NULL
    COMMENT 'Nama admin yang membatalkan transaksi' AFTER voided_at,
  ADD COLUMN IF NOT EXISTS void_reason VARCHAR(255) NULL
    COMMENT 'Alasan pembatalan (wajib diisi dari form void)' AFTER voided_by;

-- ─── JOURNAL_ENTRIES: reference_type 'void' untuk jurnal pembalik ─────────
-- Mencakup seluruh referenceType yang dipakai kode (lihat juga
-- journal_reference_type_fix.sql) DITAMBAH 'void'.
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
    'void',
    'manual'
  )
  NOT NULL DEFAULT 'manual';

-- ─── RECEIVABLES: status 'dibatalkan' untuk piutang Open Bill yang di-void ─
ALTER TABLE receivables
  MODIFY COLUMN status
  ENUM('belum_lunas', 'sebagian', 'lunas', 'dibatalkan')
  NOT NULL DEFAULT 'belum_lunas';