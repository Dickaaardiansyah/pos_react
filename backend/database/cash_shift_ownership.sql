-- database/cash_shift_ownership.sql

USE pos_refactor;

ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS opened_by_user_id INT UNSIGNED NULL
    COMMENT 'Kasir pemilik sesi ini — SELALU dari req.user.id (JWT), tidak pernah dari body'
    AFTER opened_by,
  ADD COLUMN IF NOT EXISTS closed_by_user_id INT UNSIGNED NULL
    COMMENT 'Kasir yang menutup sesi ini — SELALU dari req.user.id (JWT)'
    AFTER closed_by;

CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_by_user ON cash_shifts(opened_by_user_id);

-- Catatan: MySQL/MariaDB tidak mendukung "ADD CONSTRAINT IF NOT EXISTS" untuk
-- FOREIGN KEY. Migration ini idempotent untuk kolomnya (IF NOT EXISTS di
-- atas), tapi FK di bawah hanya jalankan SEKALI. Kalau migration ini pernah
-- dijalankan sebelumnya dan error "Duplicate foreign key" muncul, itu artinya
-- FK sudah ada — aman diabaikan.
-- ON DELETE SET NULL: kalau akun user dihapus, histori sesi kas lama tidak
-- ikut hilang (label nama VARCHAR opened_by/closed_by tetap ada sebagai jejak).
ALTER TABLE cash_shifts
  ADD CONSTRAINT fk_cash_shifts_opened_by_user
    FOREIGN KEY (opened_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cash_shifts
  ADD CONSTRAINT fk_cash_shifts_closed_by_user
    FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;