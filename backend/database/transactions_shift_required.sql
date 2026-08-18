-- database/transactions_shift_required.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration OPSIONAL: mengunci transactions.shift_id di level database
-- (NOT NULL), menyusul review dosen — "shift_id wajib untuk transaksi yang
-- dilakukan di POS, jangan hanya divalidasi di level aplikasi".
--
-- SUDAH diterapkan di level aplikasi (services/transactionService.js):
-- checkout() sekarang menolak transaksi baru kalau tidak ada sesi kas aktif.
-- Migration ini adalah lapisan pertahanan KEDUA di level database — opsional,
-- tapi disarankan setelah data lama dibereskan (lihat langkah 1 di bawah).
--
-- PENTING — baca dulu sebelum menjalankan:
--   1. Kolom shift_id sebelumnya NULLABLE (lihat void_approval.sql) dan
--      transaksi lama (sebelum fix checkout, atau sebelum kolom ini ada)
--      kemungkinan besar punya shift_id = NULL. NOT NULL akan GAGAL kalau
--      masih ada baris NULL — jalankan query pengecekan di langkah 1 dulu,
--      lalu putuskan mau diisi shift_id perkiraan (mis. shift yang aktif
--      pada rentang waktu transaksi itu) atau dibiarkan (skip migration ini).
--   2. FK fk_transactions_shift saat ini ON DELETE SET NULL — supaya histori
--      transaksi tidak ikut hilang kalau sesi kas yang menaunginya dihapus.
--      Begitu shift_id jadi NOT NULL, constraint ON DELETE SET NULL akan
--      GAGAL saat dieksekusi (mencoba set NULL ke kolom NOT NULL). Migration
--      ini otomatis mengganti behaviour-nya jadi ON DELETE RESTRICT (sesi
--      kas yang masih punya transaksi tidak akan bisa dihapus sama sekali —
--      ini sudah seharusnya begitu, karena cash_shifts pada praktiknya
--      memang tidak pernah dihapus, hanya ditutup).
-- ─────────────────────────────────────────────────────────────────────────────

USE pos_refactor;

-- ─── Langkah 1: CEK dulu — jangan lanjut kalau masih ada baris NULL ───────
-- Jalankan query ini secara terpisah dan periksa hasilnya SEBELUM lanjut ke
-- langkah 2 & 3 di bawah:
--
--   SELECT id, transaction_code, created_at, status
--   FROM transactions
--   WHERE shift_id IS NULL;
--
-- Kalau hasilnya kosong, lanjut ke langkah 2. Kalau ada baris, putuskan dulu
-- cara menanganinya (isi manual berdasarkan shift yang aktif pada waktu itu,
-- atau biarkan skema tetap NULLABLE dan cukup andalkan validasi aplikasi).

-- ─── Langkah 2: ganti FK jadi ON DELETE RESTRICT ──────────────────────────
ALTER TABLE transactions
  DROP FOREIGN KEY fk_transactions_shift;

ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_shift
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE RESTRICT;

-- ─── Langkah 3: kunci NOT NULL ─────────────────────────────────────────────
ALTER TABLE transactions
  MODIFY COLUMN shift_id INT UNSIGNED NOT NULL
    COMMENT 'Sesi kas (cash_shifts) yang aktif saat transaksi dibuat. WAJIB diisi — checkout() menolak transaksi tanpa sesi kas aktif (lihat review dosen poin shift_id).';