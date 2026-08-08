-- ============================================================
--  POS SYSTEM — MySQL 8.0+ / MariaDB / XAMPP
--  Jalankan: mysql -u root -p < init.sql
--  Atau import via phpMyAdmin
--
--  Perubahan pada refactor ini:
--   • Tabel ai_analyses dihapus (fitur AI dicabut dari sistem)
--   • transaction_items.unit_cost ditambahkan — menyimpan snapshot harga
--     modal saat transaksi terjadi, agar Laporan Laba Rugi (HPP) tetap
--     akurat meskipun harga modal produk berubah di kemudian hari.
--   • products.stock/min_stock, transaction_items.quantity, dan
--     stock_history.quantity/previous_stock/new_stock memakai
--     DECIMAL(15,3) (bukan INT) sejak awal, supaya produk dengan satuan
--     pecahan (mis. 0,25 kg, 0,5 liter) bisa langsung didukung tanpa
--     perlu menjalankan migration tambahan pada instalasi baru.
--
--  Untuk instalasi BARU: cukup jalankan init.sql lalu file-file modul
--  di database/ (purchase.sql, stock_opname.sql, product_options.sql,
--  dst. — lihat database/DATABASE_SETUP.md untuk urutan lengkap).
--  File 01_decimal_stock_qty.sql dan 02_decimal_stock_qty.sql HANYA
--  perlu dijalankan untuk meng-upgrade database LAMA yang dibuat
--  sebelum perubahan ini (skema lama masih INT).
-- ============================================================

CREATE DATABASE IF NOT EXISTS pos_refactor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pos_refactor;

-- ─── CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PRODUCTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barcode      VARCHAR(50)  NOT NULL UNIQUE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  category_id  INT UNSIGNED,
  price        DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
  stock        DECIMAL(15,3) NOT NULL DEFAULT 0,
  min_stock    DECIMAL(15,3) NOT NULL DEFAULT 5,
  lead_time_value     DECIMAL(8,2) NULL COMMENT 'Rata-rata waktu tunggu pemesanan ke supplier sampai barang diterima, dalam satuan rop_time_unit. NULL = Reorder Point tidak dihitung untuk produk ini.',
  safety_stock_value  DECIMAL(8,2) NULL COMMENT 'Cadangan (HC) dalam satuan rop_time_unit — dipakai menghitung Safety Stock.',
  rop_time_unit       ENUM('hari','jam') NOT NULL DEFAULT 'hari' COMMENT 'Satuan waktu untuk lead_time_value & safety_stock_value.',
  unit         VARCHAR(20) DEFAULT 'pcs',
  image_url    VARCHAR(500),
  is_active    TINYINT(1) DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(30) NOT NULL UNIQUE,
  total_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount       DECIMAL(15,2) NOT NULL DEFAULT 0,
  final_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method   ENUM('cash','debit','qris','transfer') DEFAULT 'cash',
  payment_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
  change_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
  customer_name    VARCHAR(100),
  cashier_name     VARCHAR(100) DEFAULT 'Kasir',
  notes            TEXT,
  status           ENUM('completed','cancelled','pending') DEFAULT 'completed',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── TRANSACTION ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id   INT UNSIGNED NOT NULL,
  product_id       INT UNSIGNED NOT NULL,
  product_name     VARCHAR(200) NOT NULL,
  product_barcode  VARCHAR(50)  NOT NULL,
  quantity         DECIMAL(15,3) NOT NULL DEFAULT 1,
  unit_price       DECIMAL(15,2) NOT NULL,
  unit_cost        DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Snapshot harga modal saat transaksi — dasar perhitungan HPP/COGS',
  discount         DECIMAL(15,2) NOT NULL DEFAULT 0,
  subtotal         DECIMAL(15,2) NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)    REFERENCES products(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STOCK HISTORY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_history (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      INT UNSIGNED NOT NULL,
  type            ENUM('in','out','adjustment') NOT NULL,
  quantity        DECIMAL(15,3) NOT NULL,
  previous_stock  DECIMAL(15,3) NOT NULL,
  new_stock       DECIMAL(15,3) NOT NULL,
  reference       VARCHAR(100),
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SETTINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  `key`       VARCHAR(100) PRIMARY KEY,
  `value`     TEXT NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','cashier') DEFAULT 'cashier',
  is_active   TINYINT(1) DEFAULT 1,
  last_login  DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CUSTOMERS (Pelanggan) ─────────────────────────────────────
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

-- ─── INDEXES untuk performa ────────────────────────────────────
CREATE INDEX idx_products_barcode    ON products(barcode);
CREATE INDEX idx_products_category   ON products(category_id);
CREATE INDEX idx_products_active     ON products(is_active);
CREATE INDEX idx_transactions_date   ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_tx_items_tx         ON transaction_items(transaction_id);
CREATE INDEX idx_tx_items_product    ON transaction_items(product_id);
CREATE INDEX idx_stock_history_prod  ON stock_history(product_id);
CREATE INDEX idx_customers_name      ON customers(name);
CREATE INDEX idx_customers_phone     ON customers(phone);

-- ============================================================
--  SEED DATA
-- ============================================================

INSERT INTO categories (id, name, description) VALUES
(1, 'Minuman',         'Berbagai jenis minuman'),
(2, 'Makanan Ringan',  'Snack dan camilan'),
(3, 'Kebutuhan Rumah', 'Produk rumah tangga'),
(4, 'Rokok',           'Produk tembakau'),
(5, 'Frozen Food',     'Makanan beku')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO products (barcode, name, category_id, price, cost_price, stock, min_stock, unit) VALUES
('8990004130093', 'Indomie Goreng',          2, 3500,  2800,  100, 20, 'pcs'),
('8888007100013', 'Aqua 600ml',              1, 4000,  2500,  150, 30, 'botol'),
('8993663900009', 'Teh Botol Sosro 350ml',   1, 4500,  3000,   80, 20, 'botol'),
('8886452100017', 'Pocari Sweat 500ml',       1, 8500,  6000,   60, 15, 'botol'),
('8997000600046', 'Oreo Original',            2, 6500,  4500,   55, 10, 'pcs'),
('8992388100306', 'Pepsodent 190gr',          3, 12000, 9000,   30,  8, 'pcs'),
('8996001101016', 'Marlboro Red',             4, 26000, 23000, 100, 20, 'bungkus'),
('8997000100047', 'Beng-Beng',               2, 4000,  2500,   80, 20, 'pcs'),
('8997000100054', 'Silver Queen 58gr',        2, 12000, 9000,   40, 10, 'pcs'),
('8991002302858', 'Coca-Cola 390ml',          1, 6000,  4000,   90, 20, 'kaleng'),
('8991002302865', 'Sprite 390ml',             1, 6000,  4000,   85, 20, 'kaleng'),
('8998009010399', 'Chitato Sapi Panggang',    2, 8500,  6000,   45, 10, 'pcs'),
('8992388201294', 'Sampo Sunsilk 170ml',      3, 15000, 11000,  25,  5, 'botol'),
('8992388201195', 'Shampoo Pantene 170ml',    3, 17000, 13000,  20,  5, 'botol'),
('8998009010504', 'Lays Original',            2, 9000,  6500,   35, 10, 'pcs')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO settings (`key`, `value`) VALUES
('store_name',              'Toko Saya'),
('store_address',           'Jl. Contoh No. 123, Kota'),
('store_phone',             '08123456789'),
('store_email',             'toko@email.com'),
('store_tagline',           'Terima kasih sudah berbelanja!'),
('currency',                'IDR'),
('tax_enabled',             'false'),
('tax_rate',                '0'),
('receipt_footer',          'Barang yang sudah dibeli tidak dapat dikembalikan'),
('low_stock_notification',  'true')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- Users default: admin/admin123 dan kasir1/kasir123
-- Password di-seed dalam base64 hanya untuk kompatibilitas data lama —
-- begitu user ini login pertama kali, backend otomatis meng-upgrade hash-nya
-- ke bcrypt (lihat services/settingService.js). Tidak perlu diubah manual.
INSERT INTO users (name, username, password, role) VALUES
('Administrator', 'admin',  'YWRtaW4xMjM=', 'admin'),
('Kasir 1',       'kasir1', 'a2FzaXIxMjM=', 'cashier')
ON DUPLICATE KEY UPDATE name = VALUES(name);