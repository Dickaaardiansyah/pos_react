-- ============================================================
-- Migration: Stock Opname & Mutasi Stok
-- Jalankan setelah init.sql, purchase.sql, dan accounting.sql
--
--   • Menambahkan tabel stock_opname_sessions & stock_opname_items
--     untuk mencatat sesi stok opname (stok sistem vs stok fisik).
--   • Menambahkan kolom created_by pada stock_history agar setiap
--     mutasi stok (penjualan, pembelian, opname, penyesuaian manual)
--     tercatat siapa penanggung jawabnya — dibutuhkan oleh laporan
--     Mutasi Stok.
--   • system_stock, physical_stock, difference, dan total_difference_qty
--     memakai DECIMAL(15,3) supaya konsisten dengan products.stock
--     (mendukung opname produk curah dalam satuan pecahan, mis. 0,5 kg).
-- ============================================================

USE pos_refactor;

-- ─── Kolom baru pada stock_history ─────────────────────────
-- Jika kolom sudah ada (mis. menjalankan ulang skrip ini), abaikan error
-- "Duplicate column name" yang muncul — itu artinya migrasi sudah pernah
-- dijalankan sebelumnya.
ALTER TABLE stock_history
  ADD COLUMN created_by VARCHAR(100) DEFAULT '' COMMENT 'User yang bertanggung jawab atas mutasi ini' AFTER notes;

CREATE INDEX idx_stock_history_created_by ON stock_history(created_by);

-- ─── STOCK OPNAME — SESI (HEADER) ──────────────────────────
CREATE TABLE IF NOT EXISTS stock_opname_sessions (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opname_code             VARCHAR(30)   NOT NULL UNIQUE,
  opname_date             DATE          NOT NULL,
  total_items             INT           NOT NULL DEFAULT 0,
  total_items_selisih     INT           NOT NULL DEFAULT 0,
  total_difference_qty    DECIMAL(15,3) NOT NULL DEFAULT 0,
  total_difference_value  DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes                   TEXT,
  recorded_by             VARCHAR(100)  DEFAULT '',
  created_at              DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK OPNAME — DETAIL PER PRODUK ──────────────────────
CREATE TABLE IF NOT EXISTS stock_opname_items (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id        INT UNSIGNED   NOT NULL,
  product_id        INT UNSIGNED   NOT NULL,
  product_name      VARCHAR(200)   NOT NULL,
  product_barcode   VARCHAR(50)    DEFAULT '',
  unit              VARCHAR(20)    DEFAULT 'pcs',
  system_stock      DECIMAL(15,3)  NOT NULL DEFAULT 0,
  physical_stock    DECIMAL(15,3)  NOT NULL DEFAULT 0,
  difference        DECIMAL(15,3)  NOT NULL DEFAULT 0,
  difference_value  DECIMAL(15,2)  NOT NULL DEFAULT 0,
  notes             VARCHAR(255)   DEFAULT '',
  created_at        DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_so_items_session ON stock_opname_items(session_id);
CREATE INDEX idx_so_items_product ON stock_opname_items(product_id);
CREATE INDEX idx_so_sessions_date  ON stock_opname_sessions(opname_date);