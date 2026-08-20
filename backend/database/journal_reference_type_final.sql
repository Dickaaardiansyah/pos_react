-- database/journal_reference_type_final.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Penetapan ENUM journal_entries.reference_type — VERSI FINAL
-- Jalankan PALING TERAKHIR, setelah SEMUA migration lain yang menyentuh
-- reference_type (journal.sql, journal_reference_type_fix.sql,
-- adjustment_journal.sql, capital.sql, openbill.sql, other_payables.sql,
-- void_transaction.sql).
--
-- Masalah (review dosen #6):
--   Setiap migration di atas melakukan
--     ALTER TABLE journal_entries MODIFY COLUMN reference_type ENUM(...)
--   dan MODIFY COLUMN MENIMPA TOTAL definisi ENUM sebelumnya, bukan
--   menambah. Masing-masing file punya daftar sendiri-sendiri yang TIDAK
--   konsisten satu sama lain:
--     • journal_reference_type_fix.sql : tidak punya payable_creation,
--       other_payable, other_payable_payment, adjustment, void
--     • adjustment_journal.sql         : tidak punya receivable_creation,
--       expense_void, cash_movement_void
--     • other_payables.sql             : tidak punya adjustment, void
--     • void_transaction.sql           : tidak punya payable_creation,
--       other_payable, other_payable_payment, adjustment
--   Akibatnya value ENUM yang akhirnya tersedia di production bergantung
--   penuh pada URUTAN eksekusi file-file ini — dan tidak satu pun dari
--   file itu (di kondisi manapun) memuat 3 value yang tetap dipakai kode:
--     • 'expense_void'        (journalService.postExpenseVoidJournal)
--     • 'cash_movement_void'  (journalService.postCashMovementVoidJournal)
--     • 'receivable_creation' (journalService.postReceivableCreationJournal,
--                               dipakai piutang manual)
--   Tanpa value ini di ENUM, insert jurnal pada 3 alur tersebut GAGAL di
--   production (data truncated for column 'reference_type'), tergantung
--   sql_mode & migration mana yang paling terakhir dijalankan.
--
-- Perbaikan:
--   Migration ini menetapkan ENUM reference_type secara LENGKAP dan FINAL,
--   mencakup SELURUH referenceType yang benar-benar dipakai di kode (lihat
--   services/journalService.js — daftar berikut diambil langsung dari sana,
--   bukan disusun ulang manual):
--     adjustment, capital, cash_movement, cash_movement_void,
--     cash_shift_close, expense, expense_void, manual, other_payable,
--     other_payable_payment, payable_creation, payable_payment, purchase,
--     receivable_creation, receivable_payment, sale, stock_opname, void
--
--   Aman dijalankan berkali-kali (idempotent) dan TIDAK bergantung urutan
--   migration reference_type lain yang sudah pernah dijalankan sebelumnya,
--   karena MODIFY COLUMN menimpa dengan definisi final yang sudah mencakup
--   semuanya. File-file lama (journal_reference_type_fix.sql,
--   adjustment_journal.sql, other_payables.sql, void_transaction.sql) TIDAK
--   perlu dihapus — bagian ALTER reference_type di dalamnya sekadar jadi
--   langkah antara yang tidak berbahaya, karena migration ini yang
--   menentukan definisi final setelah semuanya jalan. Untuk instalasi BARU,
--   migration ini cukup dijalankan sekali setelah journal.sql (tidak perlu
--   menjalankan seluruh migration antara di atas satu per satu hanya demi
--   reference_type-nya).
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

ALTER TABLE journal_entries
  MODIFY COLUMN reference_type
  ENUM(
    'adjustment',
    'capital',
    'cash_movement',
    'cash_movement_void',
    'cash_shift_close',
    'expense',
    'expense_void',
    'manual',
    'other_payable',
    'other_payable_payment',
    'payable_creation',
    'payable_payment',
    'purchase',
    'receivable_creation',
    'receivable_payment',
    'sale',
    'stock_opname',
    'void'
  )
  NOT NULL DEFAULT 'manual';