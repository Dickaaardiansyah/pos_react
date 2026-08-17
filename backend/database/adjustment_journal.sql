-- database/adjustment_journal.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Modul JURNAL PENYESUAIAN (Adjusting Entries)
-- Jalankan setelah journal.sql dan journal_reference_type_fix.sql.
--
-- Menutup 2 celah hasil review:
--   1) Beban masih harus dibayar (accrued expense) — belum ada akun Utang
--      Gaji / Utang Listrik khusus, harus buat akun dulu tiap kali.
--   2) DP Pelanggan yang barangnya belum dikirim — belum ada akun
--      "Pendapatan Diterima di Muka" (unearned revenue), sehingga DP
--      selalu jatuh ke Piutang/Penjualan seperti Open Bill biasa.
--
-- Perubahan:
--   a) Tambah 4 akun baru ke chart_of_accounts (is_system=1 supaya tidak
--      bisa dinonaktifkan sembarangan, karena akan dipakai template
--      Jurnal Penyesuaian).
--   b) Tambah value 'adjustment' ke ENUM journal_entries.reference_type
--      (MODIFY COLUMN penuh, mengikuti pola journal_reference_type_fix.sql
--      — enum lama tetap dipertahankan semua + tambah 'adjustment').
--   c) Tambah kolom reversal_of_id — dipakai fitur "Jurnal Pembalik"
--      (reversing entry) supaya jurnal penyesuaian akrual bisa dibalik
--      otomatis di awal periode berikutnya, dengan jejak ke jurnal asal.
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

-- (a) Akun baru
INSERT IGNORE INTO chart_of_accounts (account_code, account_name, account_type, normal_balance, description, is_system) VALUES
  ('2110', 'Utang Gaji',                       'kewajiban', 'kredit', 'Beban gaji periode berjalan yang belum dibayar (akrual)',            1),
  ('2120', 'Utang Listrik & Air',               'kewajiban', 'kredit', 'Tagihan listrik/air periode berjalan yang belum dibayar (akrual)',   1),
  ('2130', 'Utang Beban Lainnya (Akrual)',      'kewajiban', 'kredit', 'Beban masih harus dibayar di luar gaji & listrik/air',               1),
  ('2400', 'Pendapatan Diterima di Muka',       'kewajiban', 'kredit', 'DP/uang muka pelanggan atas barang yang belum dikirim (unearned revenue)', 1);

-- (b) Tambah 'adjustment' ke reference_type
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
    'adjustment',
    'void',
    'manual'
  )
  NOT NULL DEFAULT 'manual';

-- (c) Kolom jejak jurnal pembalik (reversing entry)
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS reversal_of_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Jika jurnal ini adalah pembalik dari jurnal penyesuaian lain, isi id jurnal asalnya'
    AFTER reference_code;

-- Catatan: MySQL/MariaDB tidak mendukung "ADD CONSTRAINT IF NOT EXISTS" untuk
-- FOREIGN KEY. Migration ini idempotent untuk kolomnya (IF NOT EXISTS di atas),
-- tapi FK di bawah hanya jalankan SEKALI. Kalau migration ini pernah dijalankan
-- sebelumnya dan error "Duplicate foreign key" muncul, itu artinya FK sudah ada
-- — aman diabaikan.
ALTER TABLE journal_entries
  ADD CONSTRAINT fk_journal_reversal
    FOREIGN KEY (reversal_of_id) REFERENCES journal_entries(id) ON DELETE SET NULL;