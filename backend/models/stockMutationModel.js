// models/stockMutationModel.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL LAYER — "Mutasi Stok" tidak punya tabel sendiri: seluruh pergerakan
// stok (penjualan, pembelian, stock opname, penyesuaian manual) SUDAH dicatat
// oleh masing-masing modul ke tabel stock_history saat transaksi terjadi.
// Model ini murni membaca & memfilter stock_history, lalu menerjemahkan
// (type + reference) menjadi label "Jenis Mutasi" yang mudah dibaca.
// ─────────────────────────────────────────────────────────────────────────────
const { query, queryOne, safeInt } = require("../config/database");

// Menentukan jenis mutasi berdasarkan pola reference/notes yang sudah dipakai
// konsisten oleh modul penjualan (TRX...), pembelian (PRC...), dan stock
// opname (SO...). Diekspresikan sebagai CASE SQL agar bisa difilter di database.
const JENIS_MUTASI_CASE = `
  CASE
    WHEN sh.reference LIKE 'TRX%' AND sh.type = 'in' THEN 'retur'
    WHEN sh.reference LIKE 'TRX%' THEN 'penjualan'
    WHEN sh.reference LIKE 'PRC%' THEN 'pembelian'
    WHEN sh.reference LIKE 'SO%'  THEN 'stock_opname'
    WHEN sh.reference = 'initial' THEN 'stok_awal'
    WHEN sh.reference = 'manual' AND sh.type = 'adjustment' THEN 'penyesuaian_manual'
    WHEN sh.type = 'in' THEN 'penyesuaian_manual'
    WHEN sh.type = 'out' THEN 'penyesuaian_manual'
    ELSE 'penyesuaian_manual'
  END
`;

const JENIS_LABELS = {
  penjualan: "Penjualan",
  pembelian: "Pembelian",
  stock_opname: "Stock Opname (Adjustment)",
  retur: "Retur",
  penyesuaian_manual: "Penyesuaian Manual",
  stok_awal: "Stok Awal",
  transfer_gudang: "Transfer Gudang",
};

const stockMutationModel = {
  jenisLabels: JENIS_LABELS,

  findAll({
    startDate,
    endDate,
    productId,
    jenis,
    type,
    limit = 50,
    offset = 0,
  } = {}) {
    const params = [];
    let where = "WHERE 1=1";
    if (startDate) {
      where += " AND DATE(sh.created_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(sh.created_at) <= ?";
      params.push(endDate);
    }
    if (productId) {
      where += " AND sh.product_id = ?";
      params.push(productId);
    }
    if (type) {
      where += " AND sh.type = ?";
      params.push(type);
    }
    if (jenis) {
      where += ` AND (${JENIS_MUTASI_CASE}) = ?`;
      params.push(jenis);
    }

    const baseSql = `
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      ${where}
    `;

    return Promise.all([
      queryOne(`SELECT COUNT(*) AS total ${baseSql}`, params),
      query(
        `SELECT
           sh.id, sh.product_id, p.name AS product_name, p.barcode AS product_barcode, p.unit,
           sh.type, ${JENIS_MUTASI_CASE} AS jenis_mutasi,
           sh.quantity,
           IF(sh.type = 'in', sh.quantity, IF(sh.type = 'adjustment' AND sh.new_stock > sh.previous_stock, sh.quantity, 0)) AS qty_masuk,
           IF(sh.type = 'out', sh.quantity, IF(sh.type = 'adjustment' AND sh.new_stock < sh.previous_stock, sh.quantity, 0)) AS qty_keluar,
           sh.previous_stock AS saldo_sebelum, sh.new_stock AS saldo_sesudah,
           sh.reference, sh.notes, sh.created_by AS user, sh.created_at
         ${baseSql}
         ORDER BY sh.created_at DESC, sh.id DESC
         LIMIT ${safeInt(limit, 50)} OFFSET ${safeInt(offset, 0)}`,
        params,
      ),
    ]).then(([totalRow, rows]) => ({
      total: Number(totalRow?.total || 0),
      rows: rows.map((r) => ({
        ...r,
        jenis_mutasi_label: JENIS_LABELS[r.jenis_mutasi] || r.jenis_mutasi,
      })),
    }));
  },

  summary({ startDate, endDate, productId } = {}) {
    const params = [];
    let where = "WHERE 1=1";
    if (startDate) {
      where += " AND DATE(sh.created_at) >= ?";
      params.push(startDate);
    }
    if (endDate) {
      where += " AND DATE(sh.created_at) <= ?";
      params.push(endDate);
    }
    if (productId) {
      where += " AND sh.product_id = ?";
      params.push(productId);
    }

    return query(
      `SELECT
         ${JENIS_MUTASI_CASE} AS jenis_mutasi,
         COUNT(*) AS total_mutasi,
         COALESCE(SUM(CASE WHEN sh.type = 'in' THEN sh.quantity WHEN sh.type = 'adjustment' AND sh.new_stock > sh.previous_stock THEN sh.quantity ELSE 0 END), 0) AS total_qty_masuk,
         COALESCE(SUM(CASE WHEN sh.type = 'out' THEN sh.quantity WHEN sh.type = 'adjustment' AND sh.new_stock < sh.previous_stock THEN sh.quantity ELSE 0 END), 0) AS total_qty_keluar
       FROM stock_history sh
       JOIN products p ON sh.product_id = p.id
       ${where}
       GROUP BY jenis_mutasi`,
      params,
    ).then((rows) =>
      rows.map((r) => ({
        ...r,
        jenis_mutasi_label: JENIS_LABELS[r.jenis_mutasi] || r.jenis_mutasi,
      })),
    );
  },
};

module.exports = stockMutationModel;
