-- database/journal.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Modul Jurnal Akuntansi Otomatis (Double-Entry Bookkeeping):
--   • chart_of_accounts   → Daftar Akun (Chart of Accounts / COA)
--   • journal_entries     → Header jurnal (satu transaksi akuntansi)
--   • journal_entry_lines → Detail baris debit/kredit per akun
--
-- Buku Besar (General Ledger) & Neraca Saldo (Trial Balance) TIDAK disimpan
-- sebagai tabel terpisah — keduanya adalah hasil query/agregat dari
-- journal_entry_lines yang dikelompokkan per akun (lihat journalService.js:
-- generalLedger() & trialBalance()). Ini konsisten dengan prinsip akuntansi:
-- buku besar = kumpulan seluruh jurnal per akun, neraca saldo = ringkasan
-- saldo akhir tiap akun.
--
-- Prinsip posting: setiap journal_entry WAJIB balance (total debit = total
-- kredit) — divalidasi di journalService.postEntry() sebelum disimpan.
-- Setiap transaksi bisnis (penjualan, pembelian, biaya, kas kecil, tutup
-- kas, stock opname) otomatis memicu satu journal_entry lewat "hook" di
-- masing-masing service terkait (lihat komentar POSTING OTOMATIS di
-- services/journalService.js).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_code   VARCHAR(20)   NOT NULL UNIQUE,
  account_name   VARCHAR(150)  NOT NULL,
  account_type   ENUM('aset','kewajiban','modal','pendapatan','beban') NOT NULL,
  normal_balance ENUM('debit','kredit') NOT NULL COMMENT 'Posisi saldo normal akun ini bertambah',
  description    VARCHAR(255)  DEFAULT '',
  is_active      TINYINT(1)    DEFAULT 1,
  is_system      TINYINT(1)    DEFAULT 0 COMMENT '1 = dipakai posting otomatis sistem, tidak boleh dihapus',
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(account_type);

CREATE TABLE IF NOT EXISTS journal_entries (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_code     VARCHAR(30)   NOT NULL UNIQUE,
  entry_date     DATE          NOT NULL,
  description    VARCHAR(255)  DEFAULT '',
  reference_type ENUM('sale','purchase','expense','cash_movement','cash_shift_close','stock_opname','manual') NOT NULL DEFAULT 'manual',
  reference_id   INT UNSIGNED  DEFAULT NULL COMMENT 'ID baris sumber di modul terkait (mis. id transaksi penjualan)',
  reference_code VARCHAR(30)   DEFAULT '' COMMENT 'Kode dokumen sumber (mis. TRX2026..., PRC2026...) utk ditampilkan',
  total_debit    DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit   DECIMAL(15,2) NOT NULL DEFAULT 0,
  source         ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  created_by     VARCHAR(100)  DEFAULT 'Sistem',
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_ref   ON journal_entries(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id INT UNSIGNED NOT NULL,
  account_id       INT UNSIGNED NOT NULL,
  debit            DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit           DECIMAL(15,2) NOT NULL DEFAULT 0,
  description      VARCHAR(255)  DEFAULT '',
  line_order       INT UNSIGNED  DEFAULT 0,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_jel_entry   ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);

-- ─── Seed Chart of Accounts dasar untuk toko retail (Toko Sumber Rahayu) ───
-- Kode mengikuti konvensi umum: 1xxx Aset, 2xxx Kewajiban, 3xxx Modal,
-- 4xxx Pendapatan, 5xxx Beban.
INSERT IGNORE INTO chart_of_accounts (account_code, account_name, account_type, normal_balance, description, is_system) VALUES
  ('1100', 'Kas',                              'aset',       'debit',  'Uang tunai di laci/kasir',                         1),
  ('1150', 'Kas di Bank / Non-Tunai',           'aset',       'debit',  'Penerimaan debit, QRIS, transfer',                 1),
  ('1200', 'Persediaan Barang Dagang',          'aset',       'debit',  'Nilai stok barang dagang (HPP)',                   1),
  ('2100', 'Utang Usaha',                       'kewajiban',  'kredit', 'Utang ke supplier (belum dipakai otomatis)',       0),
  ('3100', 'Modal Pemilik',                     'modal',      'kredit', 'Setoran modal pemilik',                            1),
  ('3200', 'Prive / Laba Ditahan',              'modal',      'kredit', 'Penarikan pemilik / akumulasi laba',               0),
  ('4100', 'Penjualan',                         'pendapatan', 'kredit', 'Pendapatan penjualan barang dagang',               1),
  ('4200', 'Diskon Penjualan',                  'pendapatan', 'debit',  'Kontra akun pendapatan — potongan harga',          1),
  ('4900', 'Pendapatan Lain-lain',               'pendapatan', 'kredit', 'Selisih kas/stok lebih, pengembalian, dll',        1),
  ('5100', 'Harga Pokok Penjualan (HPP)',       'beban',      'debit',  'Harga modal barang yang terjual',                  1),
  ('5210', 'Beban Sewa Tempat',                 'beban',      'debit',  '', 1),
  ('5220', 'Beban Gaji Karyawan',               'beban',      'debit',  '', 1),
  ('5230', 'Beban Listrik & Air',               'beban',      'debit',  '', 1),
  ('5240', 'Beban Pemasaran/Promosi',           'beban',      'debit',  '', 1),
  ('5250', 'Beban Transportasi/Logistik',       'beban',      'debit',  '', 1),
  ('5260', 'Beban Perawatan & Perbaikan',       'beban',      'debit',  '', 1),
  ('5270', 'Beban Administrasi & ATK',          'beban',      'debit',  '', 1),
  ('5280', 'Beban Operasional Lainnya',         'beban',      'debit',  '', 1),
  ('5310', 'Beban Kas Kecil Lainnya',           'beban',      'debit',  'Pengeluaran kas kecil insidental (sedekah, dll)',  1),
  ('5900', 'Beban Selisih Kas',                 'beban',      'debit',  'Selisih kurang saat tutup kas',                    1),
  ('5910', 'Beban Selisih Stok (Opname)',       'beban',      'debit',  'Selisih kurang stok fisik vs sistem',              1);