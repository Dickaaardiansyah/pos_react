-- database/cash_register.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Modul Kas Kecil (Cash Register): mencatat pengeluaran/pemasukan kas tunai
-- insidental (mis. sedekah, beli galon, transportasi) di luar penjualan &
-- biaya operasional bulanan, serta proses "Tutup Kas" yang merekonsiliasi
-- saldo kas sistem terhadap hasil hitung fisik pada akhir shift.
--
-- Alur singkat:
--   1. Kasir/Admin membuka sesi kas (cash_shifts) dengan modal awal.
--   2. Sepanjang sesi berjalan, setiap pengeluaran/pemasukan tunai kecil
--      dicatat di cash_movements (type: in/out) — TERMASUK kasus "sedekah
--      Rp10.000" pada contoh kasus awal.
--   3. Saat tutup kas, sistem menghitung saldo seharusnya:
--        saldo_sistem = modal_awal + total_penjualan_tunai + total_kas_masuk
--                       - total_kas_keluar
--      lalu dibandingkan dengan hasil hitung fisik di laci (input manual)
--      untuk menghasilkan `difference` (selisih).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_shifts (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_code               VARCHAR(30)    NOT NULL UNIQUE,
  opening_balance          DECIMAL(15,2)  NOT NULL DEFAULT 0,
  opening_notes            VARCHAR(255)   DEFAULT '',
  opened_by                VARCHAR(100)   DEFAULT 'Admin',
  opened_at                DATETIME       DEFAULT CURRENT_TIMESTAMP,

  -- Diisi hanya saat proses tutup kas (status berubah menjadi 'closed')
  closing_balance_system   DECIMAL(15,2)  DEFAULT NULL COMMENT 'Saldo seharusnya menurut sistem',
  closing_balance_physical DECIMAL(15,2)  DEFAULT NULL COMMENT 'Hasil hitung fisik di laci (input manual)',
  difference               DECIMAL(15,2)  DEFAULT NULL COMMENT 'Fisik - Sistem (negatif = kurang, positif = lebih)',
  total_cash_sales         DECIMAL(15,2)  DEFAULT NULL COMMENT 'Snapshot total penjualan tunai selama shift',
  total_cash_in            DECIMAL(15,2)  DEFAULT NULL COMMENT 'Snapshot total kas masuk (di luar penjualan)',
  total_cash_out           DECIMAL(15,2)  DEFAULT NULL COMMENT 'Snapshot total kas keluar',
  closing_notes            VARCHAR(255)   DEFAULT '',
  closed_by                VARCHAR(100)   DEFAULT NULL,
  closed_at                DATETIME       DEFAULT NULL,

  status                   ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at               DATETIME       DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_cash_shifts_status    ON cash_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened_at ON cash_shifts(opened_at);

CREATE TABLE IF NOT EXISTS cash_movements (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shift_id      INT UNSIGNED NOT NULL,
  type          ENUM('in','out') NOT NULL COMMENT 'in = kas masuk di luar penjualan, out = kas keluar/cash out',
  category      VARCHAR(50)    NOT NULL DEFAULT 'lainnya',
  amount        DECIMAL(15,2)  NOT NULL,
  description   VARCHAR(255)   DEFAULT '',
  created_by    VARCHAR(100)   DEFAULT 'Admin',
  created_at    DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type  ON cash_movements(type);