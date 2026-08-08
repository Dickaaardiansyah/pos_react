// models/settingModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — pengaturan toko & manajemen pengguna (kasir/admin).
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, insert, execute } = require("../config/database");

const settingModel = {
  findAllSettings() {
    return query("SELECT `key`, `value` FROM settings");
  },
  upsertSetting(key, value) {
    return execute(
      "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [key, value],
    );
  },

  // ─── Users ──────────────────────────────────────────────────────────────
  findAllUsers() {
    return query("SELECT id, name, username, role, is_active, last_login, created_at FROM users ORDER BY name");
  },
  findUserByUsername(username) {
    return queryOne("SELECT id FROM users WHERE username = ?", [username]);
  },
  findActiveUserByUsername(username) {
    return queryOne("SELECT * FROM users WHERE username = ? AND is_active = 1", [username]);
  },
  findUserById(id) {
    return queryOne("SELECT * FROM users WHERE id = ?", [id]);
  },
  createUser({ name, username, hashedPassword, role }) {
    return insert("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)", [name, username, hashedPassword, role || "cashier"]);
  },
  findPublicUserById(id) {
    return queryOne("SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?", [id]);
  },
  updateUser(id, existing, patch) {
    return execute(
      "UPDATE users SET name=?, role=?, is_active=?, password=? WHERE id=?",
      [
        patch.name ?? existing.name,
        patch.role ?? existing.role,
        patch.isActive !== undefined ? patch.isActive : existing.is_active,
        patch.hashedPassword ?? existing.password,
        id,
      ],
    );
  },
  deactivateUser(id) {
    return execute("UPDATE users SET is_active = 0 WHERE id = ?", [id]);
  },
  touchLastLogin(id) {
    return execute("UPDATE users SET last_login = NOW() WHERE id = ?", [id]);
  },

  // ─── Export helpers (data mentah untuk CSV) ────────────────────────────
  findTransactionsForExport(startDate, endDate) {
    return query(
      `SELECT
         t.transaction_code AS 'Kode Transaksi', t.created_at AS 'Waktu', t.cashier_name AS 'Kasir',
         t.customer_name AS 'Pelanggan', t.total_amount AS 'Subtotal', t.discount_amount AS 'Diskon',
         t.final_amount AS 'Total', t.payment_method AS 'Metode Bayar', t.payment_amount AS 'Jumlah Bayar',
         t.change_amount AS 'Kembalian', t.status AS 'Status'
       FROM transactions t WHERE DATE(t.created_at) BETWEEN ? AND ? ORDER BY t.created_at DESC`,
      [startDate, endDate],
    );
  },
  findProductsForExport() {
    return query(
      `SELECT
         p.barcode AS 'Barcode', p.name AS 'Nama Produk', c.name AS 'Kategori',
         p.price AS 'Harga Jual', p.cost_price AS 'Harga Modal', p.stock AS 'Stok',
         p.min_stock AS 'Minimum Stok', p.unit AS 'Satuan',
         IF(p.is_active=1,'Aktif','Nonaktif') AS 'Status', p.created_at AS 'Dibuat'
       FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.name`,
    );
  },
};

module.exports = settingModel;
