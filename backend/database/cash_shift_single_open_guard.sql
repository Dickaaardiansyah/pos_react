-- database/cash_shift_single_open_guard.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Guard "satu sesi kas open" per kasir (FIX revisi dosen #13)
-- Jalankan setelah cash_shift_ownership.sql.
--
-- CATATAN DESAIN (meluruskan komentar lama di cash_shift_ownership.sql):
-- migration itu dulu menulis "hanya boleh ada SATU sesi kas 'open' secara
-- GLOBAL" — itu SUDAH TIDAK BERLAKU. Desain sekarang (lihat
-- cashRegisterService.openShift() / cashRegisterModel.findOwnOpenShift()) :
-- tiap KASIR boleh punya sesi kas terbuka masing-masing secara independen
-- (kasir A buka kas tidak menghalangi kasir B buka kas sendiri) — yang TIDAK
-- boleh adalah SATU kasir yang sama membuka DUA sesi kas sekaligus.
--
-- Masalah (temuan review): pengecekan "kasir ini sudah punya sesi open?"
-- (findOwnOpenShift) dan penulisan sesi baru (createShift) TIDAK atomic —
-- dua request "buka kas" dari kasir yang sama, nyaris bersamaan (mis. double-
-- click, atau dua tab), bisa sama-sama lolos pengecekan (membaca "belum ada
-- sesi open" sebelum salah satu sempat INSERT), lalu keduanya INSERT — kasir
-- itu jadi punya 2 baris cash_shifts berstatus 'open' sekaligus, padahal
-- desainnya harus 1:1 (kasir <-> sesi kas aktifnya).
--
-- Fix: generated column + UNIQUE INDEX. open_guard bernilai
-- opened_by_user_id HANYA kalau status masih 'open'; NULL kalau sudah
-- 'closed'. MySQL/MariaDB UNIQUE INDEX mengizinkan banyak baris NULL, tapi
-- HANYA SATU baris per nilai non-NULL — jadi satu opened_by_user_id hanya
-- bisa muncul SEKALI dengan status 'open' di seluruh tabel, ditegakkan oleh
-- DB sendiri (bukan cuma app-level check-then-insert yang rawan race).
--
-- KETERBATASAN YANG DISADARI: sesi lama (dibuat sebelum
-- cash_shift_ownership.sql, opened_by_user_id IS NULL) tetap TIDAK tercakup
-- guard ini — CASE WHEN status='open' THEN NULL (opened_by_user_id kosong)
-- ELSE NULL END selalu menghasilkan NULL, jadi banyak sesi "open" ber-owner
-- NULL tetap bisa hidup bersamaan tanpa dicegah constraint ini. Ini
-- dianggap dapat diterima karena migration ownership sudah lama berjalan
-- dan sesi baru selalu terisi opened_by_user_id.
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS open_guard INT UNSIGNED
    GENERATED ALWAYS AS (
      CASE WHEN status = 'open' THEN opened_by_user_id ELSE NULL END
    ) STORED
    COMMENT 'Kolom generated — jangan diisi manual. Dipakai unique index di bawah untuk mencegah satu kasir membuka 2 sesi kas open sekaligus.'
    AFTER opened_by_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_shifts_single_open_per_cashier
  ON cash_shifts(open_guard);