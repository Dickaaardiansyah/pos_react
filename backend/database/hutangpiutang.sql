-- ============================================================
-- Migration: Modul Piutang (Pelanggan) & Hutang (Pemasok)
-- Jalankan sekali di MySQL/phpMyAdmin setelah init.sql, customer.sql,
-- dan purchase.sql (butuh tabel customers & suppliers).
-- ============================================================

USE pos_refactor;

-- ─── PIUTANG (header) ───────────────────────────────────────────
-- Satu baris = satu faktur/tagihan piutang ke pelanggan. Bisa dibuat manual
-- (mis. utang lama pelanggan) atau ditautkan ke transaksi penjualan kredit
-- lewat transaction_id (opsional).
CREATE TABLE IF NOT EXISTS receivables (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_code     VARCHAR(30)    NOT NULL UNIQUE,
  customer_id      INT UNSIGNED   DEFAULT NULL,
  customer_name    VARCHAR(150)   NOT NULL,
  transaction_id   INT UNSIGNED   DEFAULT NULL,
  amount           DECIMAL(15,2)  NOT NULL DEFAULT 0,
  paid_amount      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  invoice_date     DATE           NOT NULL,
  due_date         DATE           NOT NULL,
  status           ENUM('belum_lunas','sebagian','lunas') NOT NULL DEFAULT 'belum_lunas',
  notes            TEXT,
  recorded_by      VARCHAR(100)   DEFAULT '',
  created_at       DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id)    REFERENCES customers(id)    ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── HISTORI PEMBAYARAN PIUTANG ─────────────────────────────────
CREATE TABLE IF NOT EXISTS receivable_payments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receivable_id  INT UNSIGNED   NOT NULL,
  amount         DECIMAL(15,2)  NOT NULL,
  payment_date   DATE           NOT NULL,
  payment_method ENUM('cash','debit','qris','transfer') DEFAULT 'cash',
  notes          TEXT,
  recorded_by    VARCHAR(100)   DEFAULT '',
  created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── HUTANG (header) ────────────────────────────────────────────
-- Satu baris = satu faktur/tagihan hutang ke pemasok. Bisa dibuat manual
-- atau ditautkan ke pembelian kredit lewat purchase_id (opsional).
CREATE TABLE IF NOT EXISTS payables (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_code     VARCHAR(30)    NOT NULL UNIQUE,
  supplier_id      INT            DEFAULT NULL,
  supplier_name    VARCHAR(150)   NOT NULL,
  purchase_id      INT            DEFAULT NULL,
  amount           DECIMAL(15,2)  NOT NULL DEFAULT 0,
  paid_amount      DECIMAL(15,2)  NOT NULL DEFAULT 0,
  invoice_date     DATE           NOT NULL,
  due_date         DATE           NOT NULL,
  status           ENUM('belum_lunas','sebagian','lunas') NOT NULL DEFAULT 'belum_lunas',
  notes            TEXT,
  recorded_by      VARCHAR(100)   DEFAULT '',
  created_at       DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── HISTORI PEMBAYARAN HUTANG ──────────────────────────────────
CREATE TABLE IF NOT EXISTS payable_payments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payable_id     INT UNSIGNED   NOT NULL,
  amount         DECIMAL(15,2)  NOT NULL,
  payment_date   DATE           NOT NULL,
  payment_method ENUM('cash','debit','qris','transfer') DEFAULT 'cash',
  notes          TEXT,
  recorded_by    VARCHAR(100)   DEFAULT '',
  created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payable_id) REFERENCES payables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── INDEXES ────────────────────────────────────────────────────
CREATE INDEX idx_receivables_customer  ON receivables(customer_id);
CREATE INDEX idx_receivables_status    ON receivables(status);
CREATE INDEX idx_receivables_due       ON receivables(due_date);
CREATE INDEX idx_recv_payments_recv    ON receivable_payments(receivable_id);

CREATE INDEX idx_payables_supplier     ON payables(supplier_id);
CREATE INDEX idx_payables_status       ON payables(status);
CREATE INDEX idx_payables_due          ON payables(due_date);
CREATE INDEX idx_pay_payments_pay      ON payable_payments(payable_id);