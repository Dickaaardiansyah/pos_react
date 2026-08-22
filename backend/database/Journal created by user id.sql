-- ============================================================
-- Migration: Audit trail jurnal — tautkan created_by ke user_id
-- (revisi dosen #16 — created_by pada journal_entries [jurnal manual,
-- jurnal penyesuaian, jurnal pembalik] sebelumnya murni snapshot nama
-- yang bisa dikirim bebas dari client/payload; sekarang ditambah
-- created_by_user_id yang diisi dari req.user.id (server-side, tidak
-- bisa dipalsukan client) supaya audit trail akuntansi tetap valid.
--
-- Jalankan sekali di MySQL/phpMyAdmin, SETELAH init.sql / journal schema.
-- ============================================================

USE pos_refactor;

ALTER TABLE journal_entries
  ADD COLUMN created_by_user_id INT UNSIGNED DEFAULT NULL AFTER created_by,
  ADD CONSTRAINT fk_journal_entries_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_journal_entries_created_by_user ON journal_entries(created_by_user_id);