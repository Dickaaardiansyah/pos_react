-- ============================================================
-- Migration: Audit trail pembelian — tautkan recorded_by ke user_id
-- (revisi dosen #15 — recorded_by pada purchases sebelumnya murni
-- snapshot nama yang bisa dikirim bebas dari client/payload; sekarang
-- ditambah recorded_by_user_id yang diisi dari req.user.id (server-side,
-- tidak bisa dipalsukan client) supaya audit trail tetap valid walau
-- nama user berubah di kemudian hari.
--
-- Jalankan sekali di MySQL/phpMyAdmin, SETELAH purchase.sql.
-- ============================================================

USE pos_refactor;

ALTER TABLE purchases
  ADD COLUMN recorded_by_user_id INT UNSIGNED DEFAULT NULL AFTER recorded_by,
  ADD CONSTRAINT fk_purchases_recorded_by_user
    FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_purchases_recorded_by_user ON purchases(recorded_by_user_id);