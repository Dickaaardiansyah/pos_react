// models/customerModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — modul Pelanggan: query mentah saja, aturan bisnis (validasi,
// dsb.) hidup di services/customerService.js.
// ─────────────────────────────────────────────────────────────────────────────
const {
  query,
  queryOne,
  insert,
  execute,
  safeInt,
} = require("../config/database");

const customerModel = {
  findAll({ search, limit, offset } = {}) {
    const params = [];
    let where = "WHERE is_active = 1";
    if (search) {
      where += " AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (limit !== undefined) {
      return Promise.all([
        queryOne(`SELECT COUNT(*) AS total FROM customers ${where}`, params),
        query(
          `SELECT * FROM customers ${where} ORDER BY name ASC LIMIT ${safeInt(limit, 20)} OFFSET ${safeInt(offset, 0)}`,
          params,
        ),
      ]).then(([totalRow, rows]) => ({
        total: Number(totalRow?.total || 0),
        rows,
      }));
    }

    return query(`SELECT * FROM customers ${where} ORDER BY name ASC`, params);
  },

  findById(id) {
    return queryOne("SELECT * FROM customers WHERE id = ?", [id]);
  },

  findByPhone(phone) {
    return queryOne(
      "SELECT id FROM customers WHERE phone = ? AND is_active = 1",
      [phone],
    );
  },

  create({ name, phone, email, address, notes }) {
    return insert(
      "INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)",
      [name, phone || null, email || null, address || null, notes || null],
    );
  },

  update(id, { name, phone, email, address, notes }) {
    return execute(
      "UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?",
      [name, phone || null, email || null, address || null, notes || null, id],
    );
  },

  deactivate(id) {
    return execute("UPDATE customers SET is_active = 0 WHERE id = ?", [id]);
  },
};

module.exports = customerModel;
