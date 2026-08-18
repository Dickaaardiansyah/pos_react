-- database/void_approval.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Kepemilikan Transaksi + Alur Persetujuan Void (Void Approval)
-- Jalankan setelah void_transaction.sql dan cash_shift_ownership.sql.
--
-- Menutup celah hasil review dosen: endpoint POST /transactions/:id/void
-- sebelumnya mengizinkan role 'cashier' membatalkan transaksi SIAPA PUN,
-- KAPAN PUN, tanpa persetujuan — satu-satunya syarat cuma mengisi alasan.
-- Tidak ada pemeriksaan pembuat transaksi, kepemilikan shift, rentang waktu,
-- status akun kasir, maupun persetujuan supervisor/admin.
--
-- Perbaikan pada migration ini:
--   1. transactions.cashier_id  → pemilik transaksi (SELALU dari req.user.id
--      saat checkout, TIDAK PERNAH dari body — pola yang sama dengan
--      cash_shift_ownership.sql). Dasar untuk validasi "transaksi dibuat
--      oleh siapa".
--   2. transactions.shift_id    → sesi kas yang aktif saat transaksi dibuat
--      (NULL jika tidak ada sesi aktif). Dasar untuk validasi "shift milik
--      siapa".
--   3. Tabel void_requests      → kasir TIDAK LAGI bisa langsung membatalkan
--      transaksi. Kasir hanya bisa mengajukan permintaan void (status
--      'pending'); transaksi baru benar-benar dibatalkan (stok dikembalikan,
--      jurnal dibalik) setelah admin/supervisor MENYETUJUI permintaan itu
--      (lihat services/voidRequestService.js). Admin tetap bisa membatalkan
--      langsung tanpa pengajuan (dialah otoritas persetujuan itu sendiri).
--
-- Validasi tanggal transaksi (batas waktu kasir boleh mengajukan void) dan
-- status aktif akun kasir TIDAK butuh kolom baru — keduanya dicek langsung
-- terhadap transactions.created_at dan users.is_active saat runtime di
-- voidRequestService.js.
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

-- ─── TRANSACTIONS: kepemilikan (cashier_id) & konteks shift (shift_id) ─────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS cashier_id INT UNSIGNED NULL
    COMMENT 'Kasir pemilik transaksi — SELALU dari req.user.id (JWT) saat checkout, tidak pernah dari body. NULL = data lama sebelum migration ini.'
    AFTER cashier_name,
  ADD COLUMN IF NOT EXISTS shift_id INT UNSIGNED NULL
    COMMENT 'Sesi kas (cash_shifts) yang aktif saat transaksi dibuat. NULL jika tidak ada sesi aktif saat itu.'
    AFTER cashier_id;

CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id);

-- ON DELETE SET NULL: kalau akun user / sesi kas dihapus, histori transaksi
-- lama tidak ikut hilang (label cashier_name tetap ada sebagai jejak).
ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_cashier
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

-- ─── VOID_REQUESTS: alur pengajuan & persetujuan void oleh admin ──────────
CREATE TABLE IF NOT EXISTS void_requests (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id        INT UNSIGNED NOT NULL,

  requested_by_user_id  INT UNSIGNED NOT NULL COMMENT 'Kasir pengaju — dari req.user.id, tidak pernah dari body',
  requested_by_name     VARCHAR(100) NOT NULL COMMENT 'Snapshot nama pengaju saat itu (tetap terbaca walau akun diubah/dihapus)',
  reason                VARCHAR(255) NOT NULL,
  requested_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  status                ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',

  reviewed_by_user_id   INT UNSIGNED NULL COMMENT 'Admin/supervisor yang menyetujui atau menolak — dari req.user.id',
  reviewed_by_name      VARCHAR(100) NULL,
  review_note           VARCHAR(255) NULL COMMENT 'Catatan admin, wajib diisi jika ditolak',
  reviewed_at           DATETIME NULL,

  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_void_requests_transaction (transaction_id),
  INDEX idx_void_requests_status (status),
  INDEX idx_void_requests_requester (requested_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;