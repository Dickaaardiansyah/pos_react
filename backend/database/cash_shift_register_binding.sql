-- database/cash_shift_register_binding.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- FIX (revisi dosen #13, ronde 2 — "satu shift per kasir" vs "satu shift per
-- laci"): migration cash_shift_single_open_guard.sql sebelumnya menegakkan
-- "satu kasir hanya boleh 1 sesi kas open" DAN secara implisit membolehkan
-- BEBERAPA kasir punya sesi open bersamaan — desain itu mengasumsikan toko
-- punya beberapa laci/terminal fisik. Temuan review: cash_shifts TIDAK PUNYA
-- kolom yang menyatakan laci/terminal FISIK mana yang sedang dipakai sesi
-- itu, jadi asumsi "boleh beberapa sesi open bersamaan" tidak pernah benar2
-- direpresentasikan di skema — hanya identitas kasir yang dijadikan proxy
-- untuk laci, padahal rekonsiliasi fisik (hitung uang di laci saat tutup
-- kas) dilakukan terhadap LACI, bukan terhadap orangnya.
--
-- KONDISI TOKO (dikonfirmasi): hanya 1 laci kas fisik / 1 terminal POS.
-- Fix yang benar per catatan review: "satu open shift per register/laci",
-- bukan per kasir. Migration ini menambahkan cash_registers sebagai entitas
-- eksplisit untuk laci fisik (walau saat ini baru 1 baris, TIDAK di-hardcode
-- di kode — kalau suatu saat toko menambah terminal, cukup INSERT baris
-- baru di cash_registers, tanpa migrasi skema lagi), lalu memindahkan
-- constraint keunikan sesi 'open' dari opened_by_user_id ke register_id.
--
-- Efek pada toko dengan 1 laci: karena hanya ada 1 baris cash_registers,
-- unique index di bawah otomatis membuat MAKSIMAL 1 sesi kas 'open' di
-- SELURUH toko pada satu waktu, siapa pun kasirnya — sama seperti realita
-- fisik "cuma ada 1 laci untuk dipegang". opened_by_user_id TETAP
-- dipertahankan apa adanya (kolom kepemilikan/akuntabilitas: SIAPA yang
-- sedang memegang laci itu), hanya SAJA tidak lagi dipakai sebagai basis
-- keunikan "boleh berapa sesi open sekaligus" — itu sekarang murni urusan
-- register_id.
-- Jalankan setelah cash_shift_single_open_guard.sql.
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

-- ─── Entitas laci/terminal kas fisik ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_registers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(30)   NOT NULL UNIQUE COMMENT 'Kode singkat laci, mis. LACI-1',
  name        VARCHAR(100)  NOT NULL COMMENT 'Nama tampilan, mis. "Kasir Utama"',
  terminal    VARCHAR(100)  DEFAULT NULL COMMENT 'Identitas terminal/komputer fisik (opsional, untuk multi-terminal di kemudian hari)',
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed SATU laci fisik yang saat ini ada di toko. Idempotent: hanya insert
-- kalau tabel masih kosong, supaya migration ini aman dijalankan ulang.
INSERT INTO cash_registers (code, name, is_active)
SELECT 'LACI-1', 'Kasir Utama', 1
WHERE NOT EXISTS (SELECT 1 FROM cash_registers);

-- ─── Tautkan cash_shifts ke laci fisiknya ───────────────────────────────────
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS register_id INT UNSIGNED NULL
    COMMENT 'Laci kas fisik tempat sesi ini dibuka — lihat cash_registers. Rekonsiliasi fisik dilakukan terhadap laci ini, bukan terhadap opened_by_user_id.'
    AFTER shift_code;

-- Backfill seluruh sesi lama (termasuk yang sudah closed) ke satu-satunya
-- laci yang ada saat ini — toko ini memang cuma pernah punya 1 laci fisik,
-- jadi seluruh histori memang benar berasal dari laci yang sama.
UPDATE cash_shifts
SET register_id = (SELECT id FROM cash_registers ORDER BY id ASC LIMIT 1)
WHERE register_id IS NULL;

ALTER TABLE cash_shifts
  MODIFY COLUMN register_id INT UNSIGNED NOT NULL;

ALTER TABLE cash_shifts
  ADD CONSTRAINT fk_cash_shifts_register
    FOREIGN KEY (register_id) REFERENCES cash_registers(id);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_register ON cash_shifts(register_id);

-- ─── Pindahkan constraint "satu sesi open" dari per-kasir ke per-laci ───────
-- Hapus guard lama (per opened_by_user_id) dari cash_shift_single_open_guard.sql
-- — desain itu sudah tidak berlaku untuk toko dengan 1 laci fisik.
DROP INDEX IF EXISTS uq_cash_shifts_single_open_per_cashier ON cash_shifts;
ALTER TABLE cash_shifts DROP COLUMN IF EXISTS open_guard;

-- Guard baru: open_guard_register bernilai register_id HANYA kalau status
-- masih 'open'; NULL kalau sudah 'closed'. Sama seperti pola guard lama,
-- tapi basisnya register_id, bukan opened_by_user_id — sehingga DB sendiri
-- yang menegakkan "maksimal 1 sesi open per laci", terlepas siapa pun kasir
-- yang mencoba membukanya.
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS open_guard_register INT UNSIGNED
    GENERATED ALWAYS AS (
      CASE WHEN status = 'open' THEN register_id ELSE NULL END
    ) STORED
    COMMENT 'Kolom generated — jangan diisi manual. Dipakai unique index di bawah untuk mencegah lebih dari satu sesi kas open sekaligus pada laci yang sama.'
    AFTER register_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_shifts_single_open_per_register
  ON cash_shifts(open_guard_register);