-- database/cash_shift_ownership.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Kepemilikan Sesi Kas (Cash Shift Ownership)
-- Jalankan setelah cash_register.sql.
--
-- Menutup celah hasil review: cash_shifts.opened_by / cash_movements.created_by
-- / cash_shifts.closed_by sebelumnya cuma VARCHAR bebas yang DIISI DARI
-- REQUEST BODY (req.body.opened_by / created_by / closed_by) — bukan dari
-- identitas kasir yang login (req.user). Karena findActiveShift() mengambil
-- SATU sesi kas aktif secara global (tanpa filter user), sesi yang dibuka
-- kasir A bisa langsung dipakai cash in/out bahkan ditutup oleh kasir B yang
-- login belakangan — API tidak menegakkan siapa pemilik sesi tsb.
--
-- POS ini didesain SATU terminal/laci kas fisik pada satu waktu (bukan multi
-- register), jadi tetap hanya boleh ada SATU sesi kas 'open' secara global —
-- itu benar dan dipertahankan. Yang diperbaiki: sesi itu sekarang punya
-- PEMILIK yang jelas (opened_by_user_id, diisi dari req.user.id, BUKAN dari
-- body), dan semua mutasi (cash in/out, hapus catatan, tutup kas) WAJIB
-- diverifikasi terhadap opened_by_user_id sebelum diizinkan — lihat
-- services/cashRegisterService.js.
--
-- Kolom opened_by/created_by/closed_by (VARCHAR) TETAP dipertahankan sebagai
-- label nama tampilan (dan untuk histori data lama sebelum migration ini),
-- tapi sekarang diisi dari req.user.name (server), bukan dari body.
-- ─────────────────────────────────────────────────────────────────────────────

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