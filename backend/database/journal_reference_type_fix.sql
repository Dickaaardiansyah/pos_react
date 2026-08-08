-- database/journal_reference_type_fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Perbaikan ENUM journal_entries.reference_type
-- Jalankan PALING TERAKHIR, setelah semua migrasi lain (journal.sql,
-- capital.sql, openbill.sql, dst)
--
-- Masalah:
--   journal.sql, capital.sql, dan openbill.sql sama-sama melakukan
--   ALTER TABLE ... MODIFY COLUMN reference_type ENUM(...) — setiap
--   MODIFY COLUMN MENIMPA TOTAL definisi ENUM sebelumnya (bukan menambah).
--   Akibatnya, urutan eksekusi migrasi menentukan value apa saja yang
--   akhirnya tersedia:
--     • capital.sql lalu openbill.sql → 'receivable_payment' ADA,
--       tapi 'payable_payment' TETAP TIDAK ADA di skenario manapun.
--     • openbill.sql lalu capital.sql → 'receivable_payment' HILANG lagi.
--   Sementara services/journalService.js memposting jurnal dengan
--   referenceType: 'receivable_payment' DAN 'payable_payment'
--   (pembayaran piutang & pembayaran hutang supplier). Tanpa value ini
--   di ENUM, insert jurnal untuk pembayaran hutang/piutang bisa gagal
--   atau error di production, tergantung sql_mode & urutan migrasi.
--
-- Perbaikan:
--   Migrasi ini menetapkan ENUM reference_type secara LENGKAP dan FINAL,
--   mencakup seluruh referenceType yang benar-benar dipakai di kode
--   (lihat services/journalService.js):
--     manual, sale, purchase, expense, cash_movement, cash_shift_close,
--     stock_opname, capital, receivable_payment, payable_payment
--
--   Aman dijalankan berkali-kali dan tidak bergantung urutan migrasi lain
--   dijalankan sebelumnya, karena MODIFY COLUMN bersifat idempotent untuk
--   definisi yang sama.
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

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
    'manual'
  )
  NOT NULL DEFAULT 'manual';