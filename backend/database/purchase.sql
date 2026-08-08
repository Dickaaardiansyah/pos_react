-- ============================================================
-- Migration: Modul Pembelian / Barang Masuk
-- Jalankan sekali di MySQL/phpMyAdmin, SETELAH init.sql
--
-- total_qty, quantity, previous_stock, new_stock memakai
-- DECIMAL(15,3) supaya konsisten dengan products.stock (mendukung
-- pembelian barang curah dalam satuan pecahan, mis. 0,5 kg).
-- ============================================================

USE pos_refactor;

-- Tabel supplier
CREATE TABLE IF NOT EXISTS suppliers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  phone        VARCHAR(30)  DEFAULT '',
  address      TEXT         DEFAULT '',
  notes        TEXT         DEFAULT '',
  is_active    TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel pembelian (header)
CREATE TABLE IF NOT EXISTS purchases (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  purchase_code    VARCHAR(30)    NOT NULL UNIQUE,
  supplier_id      INT            DEFAULT NULL,
  supplier_name    VARCHAR(150)   DEFAULT '',
  purchase_date    DATE           NOT NULL,
  total_items      INT            DEFAULT 0,
  total_qty        DECIMAL(15,3)  DEFAULT 0,
  total_cost       DECIMAL(15,2)  DEFAULT 0,
  notes            TEXT           DEFAULT '',
  recorded_by      VARCHAR(100)   DEFAULT '',
  status           ENUM('draft','confirmed') DEFAULT 'confirmed',
  created_at       DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel item pembelian (detail)
CREATE TABLE IF NOT EXISTS purchase_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id    INT            NOT NULL,
  product_id     INT UNSIGNED   NOT NULL,
  product_name   VARCHAR(150)   NOT NULL,
  product_barcode VARCHAR(100)  DEFAULT '',
  quantity       DECIMAL(15,3)  NOT NULL,
  unit_cost      DECIMAL(15,2)  DEFAULT 0,
  subtotal_cost  DECIMAL(15,2)  DEFAULT 0,
  previous_stock DECIMAL(15,3)  DEFAULT 0,
  new_stock      DECIMAL(15,3)  DEFAULT 0,
  created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index untuk performa query laporan
CREATE INDEX idx_purchases_date     ON purchases(purchase_date);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchase_items_pid ON purchase_items(product_id);