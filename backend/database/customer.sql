-- ============================================================
--  MODUL PELANGGAN (CUSTOMERS)
--  Jalankan: mysql -u root -p pos_refactor < customers.sql
-- ============================================================

USE pos_refactor;

CREATE TABLE IF NOT EXISTS customers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  phone       VARCHAR(30),
  email       VARCHAR(150),
  address     TEXT,
  notes       TEXT,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_customers_name  ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);