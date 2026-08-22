USE pos_refactor;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS status ENUM('draft','posted','reversed') NOT NULL DEFAULT 'posted'
    COMMENT 'draft = belum mempengaruhi laporan, boleh hard-delete. posted = sudah mempengaruhi laporan, TIDAK boleh dihapus, koreksi hanya lewat jurnal pembalik. reversed = jurnal asal yang sudah dibalik (jejaknya tetap dipertahankan).'
    AFTER source;

UPDATE journal_entries SET status = 'posted' WHERE status IS NULL;

UPDATE journal_entries je
JOIN journal_entries rev ON rev.reversal_of_id = je.id
SET je.status = 'reversed';

CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);