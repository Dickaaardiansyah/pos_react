-- ============================================================
--  DUMMY DATA GENERATOR — 5 bulan terakhir s.d. hari ini
--  Mengisi: pembelian (purchases + purchase_items), transaksi kasir
--  (transactions + transaction_items), riwayat stok, dan biaya
--  operasional bulanan (expenses) untuk keperluan demo/Laporan Laba Rugi.
--
--  CATATAN:
--   • Jalankan setelah init.sql, purchase.sql, dan accounting.sql.
--   • Skrip ini SEKARANG AMAN DIJALANKAN ULANG — di awal, ia otomatis
--     membersihkan transaksi/pembelian/biaya dummy sebelumnya dan
--     mengembalikan stok ke nilai awal (khusus 15 produk seed di init.sql),
--     baru membuat data baru dari nol.
--   • Membutuhkan waktu beberapa detik s.d. sekitar satu menit tergantung
--     performa server, karena memproses ribuan baris lewat loop.
-- ============================================================

USE pos_refactor;

-- ── Bersihkan data dummy dari eksekusi sebelumnya (aman dijalankan ulang) ──
-- Catatan: pakai DELETE (bukan TRUNCATE) agar tidak terbentur pembatasan
-- MySQL terhadap TRUNCATE pada tabel yang direferensikan FOREIGN KEY.
DELETE FROM transaction_items;
DELETE FROM transactions;
DELETE FROM purchase_items;
DELETE FROM purchases;
DELETE FROM stock_history;
DELETE FROM expenses;

UPDATE products SET stock = CASE barcode
  WHEN '8990004130093' THEN 100
  WHEN '8888007100013' THEN 150
  WHEN '8993663900009' THEN 80
  WHEN '8886452100017' THEN 60
  WHEN '8997000600046' THEN 55
  WHEN '8992388100306' THEN 30
  WHEN '8996001101016' THEN 100
  WHEN '8997000100047' THEN 80
  WHEN '8997000100054' THEN 40
  WHEN '8991002302858' THEN 90
  WHEN '8991002302865' THEN 85
  WHEN '8998009010399' THEN 45
  WHEN '8992388201294' THEN 25
  WHEN '8992388201195' THEN 20
  WHEN '8998009010504' THEN 35
  ELSE stock
END
WHERE barcode IN (
  '8990004130093','8888007100013','8993663900009','8886452100017','8997000600046',
  '8992388100306','8996001101016','8997000100047','8997000100054','8991002302858',
  '8991002302865','8998009010399','8992388201294','8992388201195','8998009010504'
);

DROP PROCEDURE IF EXISTS seed_dummy_data;

DELIMITER $$

CREATE PROCEDURE seed_dummy_data()
BEGIN
  DECLARE v_start_date   DATE;
  DECLARE v_end_date     DATE;
  DECLARE v_cur_date     DATE;
  DECLARE v_month_cursor DATE;
  DECLARE v_expense_date DATE;

  DECLARE v_tx_count_today INT;
  DECLARE i INT;
  DECLARE j INT;
  DECLARE k INT;
  DECLARE v_num_items INT;

  DECLARE v_product_id INT UNSIGNED;
  DECLARE v_p_name      VARCHAR(200);
  DECLARE v_p_barcode    VARCHAR(50);
  DECLARE v_price        DECIMAL(15,2);
  DECLARE v_cost         DECIMAL(15,2);
  DECLARE v_stock        INT;
  DECLARE v_qty          INT;
  DECLARE v_subtotal     DECIMAL(15,2);

  DECLARE v_tx_id      INT UNSIGNED;
  DECLARE v_tx_code    VARCHAR(30);
  DECLARE v_total      DECIMAL(15,2);
  DECLARE v_discount   DECIMAL(15,2);
  DECLARE v_final      DECIMAL(15,2);
  DECLARE v_total_pay  DECIMAL(15,2);
  DECLARE v_payment    VARCHAR(20);
  DECLARE v_cashier    VARCHAR(100);
  DECLARE v_created_at DATETIME;
  DECLARE v_rand_hour   INT;
  DECLARE v_rand_minute INT;

  DECLARE v_purchase_id         INT UNSIGNED;
  DECLARE v_purchase_code       VARCHAR(30);
  DECLARE v_supplier_id         INT;
  DECLARE v_supplier_name       VARCHAR(150);
  DECLARE v_purchase_items_n    INT;
  DECLARE v_purchase_qty        INT;
  DECLARE v_purchase_total_qty  INT;
  DECLARE v_purchase_total_cost DECIMAL(15,2);
  DECLARE v_prev_stock INT;
  DECLARE v_new_stock  INT;

  SET v_start_date = DATE_SUB(CURDATE(), INTERVAL 5 MONTH);
  SET v_end_date   = CURDATE();

  -- ══════════════════════════════════════════════════════════════════════
  -- 0) STOK PEMBUKAAN — supaya penjualan 5 bulan tidak sampai minus
  -- ══════════════════════════════════════════════════════════════════════
  INSERT INTO purchases
    (purchase_code, supplier_id, supplier_name, purchase_date, total_items, total_qty, total_cost, notes, recorded_by, status, created_at)
  VALUES
    (CONCAT('PRC', DATE_FORMAT(v_start_date, '%Y%m%d'), '0000'), NULL, 'Stok Pembukaan',
     v_start_date, 0, 0, 0, 'Stok pembukaan otomatis (dummy data)', 'Admin', 'confirmed', v_start_date);

  SET v_purchase_id = LAST_INSERT_ID();
  SET v_purchase_total_qty = 0;
  SET v_purchase_total_cost = 0;

  BEGIN
    DECLARE done TINYINT DEFAULT 0;
    DECLARE p_id INT UNSIGNED;
    DECLARE p_name VARCHAR(200);
    DECLARE p_barcode VARCHAR(50);
    DECLARE p_cost DECIMAL(15,2);
    DECLARE p_stock INT;
    DECLARE cur CURSOR FOR SELECT id, name, barcode, cost_price, stock FROM products WHERE is_active = 1;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
      FETCH cur INTO p_id, p_name, p_barcode, p_cost, p_stock;
      IF done THEN
        LEAVE read_loop;
      END IF;

      SET v_purchase_qty = 300 + FLOOR(RAND() * 300);
      SET v_prev_stock = p_stock;
      SET v_new_stock = p_stock + v_purchase_qty;

      INSERT INTO purchase_items
        (purchase_id, product_id, product_name, product_barcode, quantity, unit_cost, subtotal_cost, previous_stock, new_stock, created_at)
      VALUES
        (v_purchase_id, p_id, p_name, p_barcode, v_purchase_qty, p_cost, v_purchase_qty * p_cost, v_prev_stock, v_new_stock, v_start_date);

      UPDATE products SET stock = v_new_stock WHERE id = p_id;

      INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes)
      VALUES (p_id, 'in', v_purchase_qty, v_prev_stock, v_new_stock,
              CONCAT('PRC', DATE_FORMAT(v_start_date, '%Y%m%d'), '0000'), 'Stok pembukaan (dummy data)');

      SET v_purchase_total_qty = v_purchase_total_qty + v_purchase_qty;
      SET v_purchase_total_cost = v_purchase_total_cost + (v_purchase_qty * p_cost);
    END LOOP;
    CLOSE cur;
  END;

  UPDATE purchases
  SET total_items = (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = v_purchase_id),
      total_qty = v_purchase_total_qty,
      total_cost = v_purchase_total_cost
  WHERE id = v_purchase_id;

  -- ══════════════════════════════════════════════════════════════════════
  -- 1) LOOP HARIAN — transaksi kasir per hari + restock berkala (35% peluang/hari)
  -- ══════════════════════════════════════════════════════════════════════
  SET v_cur_date = v_start_date;
  SET i = 0;

  WHILE v_cur_date <= v_end_date DO
    SET v_tx_count_today = 8 + FLOOR(RAND() * 18); -- 8..25 transaksi/hari
    SET j = 0;

    WHILE j < v_tx_count_today DO
      SET v_num_items = 1 + FLOOR(RAND() * 4); -- 1..4 item/transaksi
      SET v_total = 0;
      SET v_rand_hour = 8 + FLOOR(RAND() * 13); -- jam operasional 08-20
      SET v_rand_minute = FLOOR(RAND() * 60);
      SET v_created_at = TIMESTAMP(v_cur_date, SEC_TO_TIME(v_rand_hour * 3600 + v_rand_minute * 60));

      SET v_payment = CASE
        WHEN RAND() < 0.55 THEN 'cash'
        WHEN RAND() < 0.80 THEN 'debit'
        ELSE 'qris'
      END;
      SET v_cashier = IF(RAND() < 0.5, 'Administrator', 'Kasir 1');
      SET v_tx_code = CONCAT('TRX', DATE_FORMAT(v_cur_date, '%Y%m%d'), LPAD(j + 1, 4, '0'));

      INSERT INTO transactions
        (transaction_code, total_amount, discount_amount, tax_amount, final_amount,
         payment_method, payment_amount, change_amount, customer_name, cashier_name, notes, status, created_at)
      VALUES
        (v_tx_code, 0, 0, 0, 0, v_payment, 0, 0, '', v_cashier, '', 'completed', v_created_at);

      SET v_tx_id = LAST_INSERT_ID();
      SET k = 0;

      WHILE k < v_num_items DO
        SET v_product_id = NULL;

        SELECT id, name, barcode, price, cost_price, stock
          INTO v_product_id, v_p_name, v_p_barcode, v_price, v_cost, v_stock
        FROM products
        WHERE is_active = 1 AND stock > 0
        ORDER BY RAND() LIMIT 1;

        IF v_product_id IS NOT NULL THEN
          SET v_qty = 1 + FLOOR(RAND() * 3); -- 1..3
          SET v_qty = LEAST(v_qty, v_stock);

          IF v_qty > 0 THEN
            SET v_subtotal = v_qty * v_price;

            INSERT INTO transaction_items
              (transaction_id, product_id, product_name, product_barcode, quantity, unit_price, unit_cost, discount, subtotal, created_at)
            VALUES
              (v_tx_id, v_product_id, v_p_name, v_p_barcode, v_qty, v_price, v_cost, 0, v_subtotal, v_created_at);

            UPDATE products SET stock = stock - v_qty WHERE id = v_product_id;

            INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes)
            VALUES (v_product_id, 'out', v_qty, v_stock, v_stock - v_qty, v_tx_code, 'Terjual (dummy data)');

            SET v_total = v_total + v_subtotal;
          END IF;
        END IF;

        SET k = k + 1;
      END WHILE;

      IF v_total > 0 THEN
        SET v_discount = IF(RAND() < 0.15, ROUND((v_total * 0.05) / 500) * 500, 0);
        SET v_final = GREATEST(v_total - v_discount, 0);
        SET v_total_pay = IF(v_payment = 'cash', CEIL(v_final / 1000) * 1000, v_final);

        UPDATE transactions
        SET total_amount = v_total,
            discount_amount = v_discount,
            final_amount = v_final,
            payment_amount = v_total_pay,
            change_amount = v_total_pay - v_final
        WHERE id = v_tx_id;
      ELSE
        -- Semua produk kehabisan stok saat transaksi ini diproses — batalkan baris kosong
        DELETE FROM transactions WHERE id = v_tx_id;
      END IF;

      SET j = j + 1;
    END WHILE;

    -- ── Restock rutin — peluang 35% setiap hari ─────────────────────────
    IF RAND() < 0.35 THEN
      SET v_supplier_id = NULL;
      SET v_supplier_name = NULL;

      SELECT id, name INTO v_supplier_id, v_supplier_name
      FROM suppliers ORDER BY RAND() LIMIT 1;

      SET v_created_at = TIMESTAMP(v_cur_date, '09:00:00');
      SET v_purchase_code = CONCAT('PRC', DATE_FORMAT(v_cur_date, '%Y%m%d'), LPAD(i + 1, 4, '0'));

      INSERT INTO purchases
        (purchase_code, supplier_id, supplier_name, purchase_date, total_items, total_qty, total_cost, notes, recorded_by, status, created_at)
      VALUES
        (v_purchase_code, v_supplier_id, IFNULL(v_supplier_name, 'Supplier Umum'),
         v_cur_date, 0, 0, 0, 'Restock rutin (dummy data)', 'Admin', 'confirmed', v_created_at);

      SET v_purchase_id = LAST_INSERT_ID();
      SET v_purchase_items_n = 2 + FLOOR(RAND() * 4); -- 2..5 produk
      SET v_purchase_total_qty = 0;
      SET v_purchase_total_cost = 0;
      SET k = 0;

      WHILE k < v_purchase_items_n DO
        SELECT id, name, barcode, cost_price, stock
          INTO v_product_id, v_p_name, v_p_barcode, v_cost, v_stock
        FROM products WHERE is_active = 1 ORDER BY RAND() LIMIT 1;

        SET v_purchase_qty = 20 + FLOOR(RAND() * 60); -- 20..80
        SET v_prev_stock = v_stock;
        SET v_new_stock = v_stock + v_purchase_qty;

        INSERT INTO purchase_items
          (purchase_id, product_id, product_name, product_barcode, quantity, unit_cost, subtotal_cost, previous_stock, new_stock, created_at)
        VALUES
          (v_purchase_id, v_product_id, v_p_name, v_p_barcode, v_purchase_qty, v_cost, v_purchase_qty * v_cost, v_prev_stock, v_new_stock, v_created_at);

        UPDATE products SET stock = v_new_stock WHERE id = v_product_id;

        INSERT INTO stock_history (product_id, type, quantity, previous_stock, new_stock, reference, notes)
        VALUES (v_product_id, 'in', v_purchase_qty, v_prev_stock, v_new_stock, v_purchase_code, 'Restock rutin (dummy data)');

        SET v_purchase_total_qty = v_purchase_total_qty + v_purchase_qty;
        SET v_purchase_total_cost = v_purchase_total_cost + (v_purchase_qty * v_cost);
        SET k = k + 1;
      END WHILE;

      UPDATE purchases
      SET total_items = v_purchase_items_n, total_qty = v_purchase_total_qty, total_cost = v_purchase_total_cost
      WHERE id = v_purchase_id;
    END IF;

    SET v_cur_date = DATE_ADD(v_cur_date, INTERVAL 1 DAY);
    SET i = i + 1;
  END WHILE;

  -- ══════════════════════════════════════════════════════════════════════
  -- 2) BIAYA OPERASIONAL BULANAN (untuk Laporan Laba Rugi)
  -- ══════════════════════════════════════════════════════════════════════
  SET v_month_cursor = DATE_FORMAT(v_start_date, '%Y-%m-01');

  WHILE v_month_cursor <= v_end_date DO
    SET v_expense_date = LEAST(DATE_ADD(v_month_cursor, INTERVAL 4 DAY), v_end_date);
    INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
    VALUES (v_expense_date, 'sewa', 'Sewa toko bulan berjalan', 2500000 + FLOOR(RAND() * 200000), 'Admin');

    SET v_expense_date = LEAST(DATE_ADD(v_month_cursor, INTERVAL 27 DAY), v_end_date);
    INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
    VALUES (v_expense_date, 'gaji', 'Gaji karyawan', 3000000 + FLOOR(RAND() * 400000), 'Admin');

    SET v_expense_date = LEAST(DATE_ADD(v_month_cursor, INTERVAL 9 DAY), v_end_date);
    INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
    VALUES (v_expense_date, 'listrik_air', 'Tagihan listrik & air', 350000 + FLOOR(RAND() * 250000), 'Admin');

    SET v_expense_date = LEAST(DATE_ADD(v_month_cursor, INTERVAL 14 DAY), v_end_date);
    INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
    VALUES (v_expense_date, 'pemasaran', 'Promosi & iklan lokal', 150000 + FLOOR(RAND() * 350000), 'Admin');

    SET v_expense_date = LEAST(DATE_ADD(v_month_cursor, INTERVAL 19 DAY), v_end_date);
    INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
    VALUES (v_expense_date, 'transportasi', 'Ongkos kirim & BBM', 100000 + FLOOR(RAND() * 200000), 'Admin');

    SET v_expense_date = LEAST(DATE_ADD(v_month_cursor, INTERVAL 22 DAY), v_end_date);
    INSERT INTO expenses (expense_date, category, description, amount, recorded_by)
    VALUES (v_expense_date, 'administrasi', 'ATK & keperluan kantor', 50000 + FLOOR(RAND() * 100000), 'Admin');

    SET v_month_cursor = DATE_ADD(v_month_cursor, INTERVAL 1 MONTH);
  END WHILE;

END$$

DELIMITER ;

CALL seed_dummy_data();
DROP PROCEDURE seed_dummy_data;

-- ── Ringkasan hasil ──────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM transactions) AS total_transaksi,
  (SELECT COUNT(*) FROM transaction_items) AS total_item_transaksi,
  (SELECT COUNT(*) FROM purchases) AS total_pembelian,
  (SELECT COUNT(*) FROM purchase_items) AS total_item_pembelian,
  (SELECT COUNT(*) FROM expenses) AS total_biaya_operasional,
  (SELECT MIN(created_at) FROM transactions) AS transaksi_pertama,
  (SELECT MAX(created_at) FROM transactions) AS transaksi_terakhir;