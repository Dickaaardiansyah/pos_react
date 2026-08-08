// services/stockMutationService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — laporan Mutasi Stok: menggabungkan filter, paginasi, dan
// ringkasan per jenis mutasi. Sumber data sepenuhnya dari stock_history yang
// sudah diisi otomatis oleh modul penjualan, pembelian, dan stock opname.
// ─────────────────────────────────────────────────────────────────────────────
const stockMutationModel = require("../models/stockMutationModel");
const { defaultDateRange } = require("./transactionService");

const stockMutationService = {
  jenisOptions() {
    return Object.entries(stockMutationModel.jenisLabels).map(
      ([id, label]) => ({ id, label }),
    );
  },

  async list({
    start_date,
    end_date,
    product_id,
    jenis,
    type,
    page = 1,
    limit = 30,
  }) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await stockMutationModel.findAll({
      startDate: start_date,
      endDate: end_date,
      productId: product_id,
      jenis,
      type,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  async summary({ start_date, end_date, product_id }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const rows = await stockMutationModel.summary({
      startDate,
      endDate,
      productId: product_id,
    });
    return { startDate, endDate, byType: rows };
  },
};

module.exports = stockMutationService;
