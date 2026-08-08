// services/transactionService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — proses checkout kasir, riwayat transaksi, dan laporan
// penjualan. Semua perhitungan agregat (total, rata-rata, dsb.) hidup di sini,
// bukan di controller ataupun model.
// ─────────────────────────────────────────────────────────────────────────────
const transactionModel = require("../models/transactionModel");
const {
  ValidationError,
  NotFoundError,
  productService,
} = require("./productService");

// Waktu lokal server (bukan UTC) — supaya DATE(created_at) konsisten dengan CURDATE() MySQL.
function toLocalDatetime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function generateTransactionCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `TSR${date}${rand}`;
}

// Kode faktur piutang untuk transaksi Open Bill — ditautkan ke transaction_code
// yang sudah unik, supaya tidak ada risiko tabrakan kode faktur.
function generateInvoiceCodeFromTx(transactionCode) {
  return `PIU-${transactionCode}`;
}

// Jatuh tempo default Open Bill: +30 hari dari tanggal transaksi (bisa
// ditimpa kasir lewat field due_date pada payload checkout).
function defaultDueDate(fromDate = new Date()) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + 30);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultDateRange(startDate, endDate) {
  return {
    startDate:
      startDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    endDate: endDate || new Date().toISOString().split("T")[0],
  };
}

const transactionService = {
  async checkout(payload) {
    const {
      items,
      payment_method,
      payment_amount,
      customer_name,
      customer_id,
      due_date,
      cashier_name,
      discount_amount,
      notes,
    } = payload;
    if (!items || items.length === 0)
      throw new ValidationError("Tidak ada produk dalam transaksi");

    if (payment_method === "open_bill" && !customer_name?.trim())
      throw new ValidationError(
        "Pelanggan wajib dipilih untuk transaksi Open Bill",
      );

    const transactionCode = generateTransactionCode();
    const occurredAt = toLocalDatetime();
    const openBill =
      payment_method === "open_bill"
        ? {
            invoiceCode: generateInvoiceCodeFromTx(transactionCode),
            invoiceDate: occurredAt.slice(0, 10),
            dueDate: due_date || defaultDueDate(),
          }
        : null;

    try {
      // Penyimpanan transaksi + pengurangan stok + piutang open bill + posting
      // jurnal semuanya terjadi dalam SATU DB transaction di
      // transactionModel.createSale (lihat komentar di sana). Kalau salah
      // satu langkah gagal (termasuk jurnal), semuanya di-rollback bersama —
      // tidak akan ada transaksi yang tersimpan tanpa jurnalnya.
      const sale = await transactionModel.createSale({
        items,
        paymentMethod: payment_method,
        paymentAmount: payment_amount,
        customerName: customer_name,
        customerId: customer_id,
        cashierName: cashier_name,
        discountAmount: discount_amount,
        notes,
        transactionCode,
        occurredAt,
        openBill,
      });

      return sale;
    } catch (e) {
      // Pesan yang berkaitan dengan stok/pembayaran adalah kesalahan pengguna (400)
      e.status = /tidak|kurang|wajib/i.test(e.message) ? 400 : 500;
      throw e;
    }
  },

  async list({
    start_date,
    end_date,
    limit = 50,
    page = 1,
    payment_method,
    status,
  }) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const offset = (parsedPage - 1) * parsedLimit;
    const { total, rows } = await transactionModel.findAll({
      startDate: start_date,
      endDate: end_date,
      paymentMethod: payment_method,
      status,
      limit: parsedLimit,
      offset,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  // Batal (void) transaksi — hanya untuk transaksi berstatus 'completed'.
  // Validasi keberadaan & status dilakukan dulu di sini untuk pesan error
  // yang cepat & jelas; transactionModel.voidTransaction() tetap mengunci
  // ulang & memvalidasi status di dalam DB transaction (FOR UPDATE) sebagai
  // pertahanan terakhir terhadap race condition (mis. dua admin klik void
  // hampir bersamaan).
  async voidTransaction(id, { reason, voided_by }) {
    if (!reason || !reason.trim())
      throw new ValidationError("Alasan pembatalan wajib diisi");

    const tx = await transactionModel.findById(id);
    if (!tx) throw new NotFoundError("Transaksi tidak ditemukan");
    if (tx.status !== "completed")
      throw new ValidationError(
        tx.status === "cancelled"
          ? "Transaksi ini sudah dibatalkan sebelumnya"
          : `Transaksi berstatus '${tx.status}' tidak dapat dibatalkan`,
      );

    try {
      return await transactionModel.voidTransaction(id, {
        reason: reason.trim(),
        voidedBy: voided_by,
      });
    } catch (e) {
      // Pesan validasi bisnis (piutang sudah dicicil, dsb) adalah kesalahan
      // pengguna (400), bukan error server.
      e.status = /tidak|sudah|wajib/i.test(e.message) ? 400 : 500;
      throw e;
    }
  },

  async getDetail(id) {
    const tx = await transactionModel.findById(id);
    if (!tx) throw new NotFoundError("Transaksi tidak ditemukan");
    const items = await transactionModel.findItemsByTransactionId(id);
    return { ...tx, items };
  },

  async salesReport({ period = "daily", start_date, end_date }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const [salesData, topProducts, categoryRevenue, summary, itemsSummary] =
      await Promise.all([
        transactionModel.salesGroupedByPeriod(period, startDate, endDate),
        transactionModel.topProducts(startDate, endDate),
        transactionModel.revenueByCategory(startDate, endDate),
        transactionModel.salesSummary(startDate, endDate),
        transactionModel.itemsQtySummary(startDate, endDate),
      ]);

    const totalTransactions = Number(summary?.total_transactions || 0);
    const totalItemsQty = Number(itemsSummary?.total_items_qty || 0);
    const avgItemsPerTransaction =
      totalTransactions > 0 ? totalItemsQty / totalTransactions : 0;

    return {
      summary: {
        ...summary,
        avg_items_per_transaction: avgItemsPerTransaction,
      },
      salesData,
      topProducts,
      categoryRevenue,
      startDate,
      endDate,
      period,
    };
  },

  /**
   * Laporan Penjualan berdasarkan Pelanggan — pendapatan, jumlah transaksi,
   * qty, HPP (metode rata-rata/average, mengikuti cost_price produk saat
   * transaksi terjadi), dan laba kotor per pelanggan. Berguna untuk melihat
   * pelanggan mana yang paling banyak berbelanja (mis. pelanggan Open Bill
   * langganan) dalam suatu periode.
   */
  async salesByCustomerReport({ start_date, end_date }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const [headerRows, cogsRows] = await Promise.all([
      transactionModel.salesByCustomer(startDate, endDate),
      transactionModel.cogsByCustomer(startDate, endDate),
    ]);

    const cogsMap = new Map(cogsRows.map((r) => [Number(r.customer_id), r]));

    const items = headerRows.map((r) => {
      const cogsRow = cogsMap.get(Number(r.customer_id)) || {};
      const revenue = Number(r.total_revenue || 0);
      const cogs = Number(cogsRow.total_cogs || 0);
      const profit = revenue - cogs;
      return {
        customer_id: r.customer_id ? Number(r.customer_id) : null,
        customer_name: r.customer_name,
        transaction_count: Number(r.transaction_count || 0),
        total_qty: Number(cogsRow.total_qty || 0),
        total_revenue: revenue,
        total_discount: Number(r.total_discount || 0),
        avg_transaction: Number(r.avg_transaction || 0),
        total_cogs: cogs,
        total_profit: profit,
        margin_percent:
          revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
        last_transaction_at: r.last_transaction_at,
      };
    });

    const summary = items.reduce(
      (acc, p) => {
        acc.total_customers += 1;
        acc.total_transactions += p.transaction_count;
        acc.total_qty += p.total_qty;
        acc.total_revenue += p.total_revenue;
        acc.total_cogs += p.total_cogs;
        acc.total_profit += p.total_profit;
        return acc;
      },
      {
        total_customers: 0,
        total_transactions: 0,
        total_qty: 0,
        total_revenue: 0,
        total_cogs: 0,
        total_profit: 0,
      },
    );
    summary.margin_percent =
      summary.total_revenue > 0
        ? Math.round((summary.total_profit / summary.total_revenue) * 10000) /
          100
        : 0;

    return { startDate, endDate, summary, items };
  },

  /**
   * Laba per Produk — keuntungan (pendapatan - HPP) tiap produk yang terjual
   * dalam suatu periode. HPP memakai harga modal (harga beli dari supplier)
   * yang tersimpan di setiap item transaksi, jadi produk dengan margin tipis
   * atau bahkan rugi (mis. karena harga modal naik) bisa langsung terlihat.
   */
  async productProfitReport({ start_date, end_date }) {
    const { startDate, endDate } = defaultDateRange(start_date, end_date);
    const rows = await transactionModel.profitByProduct(startDate, endDate);

    const items = rows.map((p) => {
      const revenue = Number(p.total_revenue || 0);
      const cogs = Number(p.total_cogs || 0);
      const profit = Number(p.total_profit || 0);
      return {
        product_id: p.product_id,
        name: p.name,
        barcode: p.barcode,
        category: p.category,
        base_unit: p.base_unit,
        // qty_sold  = jumlah baris/kali terjual (mis. "1x opsi ½kg + 1x opsi ¼kg" = 2)
        // qty_base  = qty dalam satuan dasar produk (mis. 0.75 kg) — pakai ini
        //             untuk "berapa banyak produk ini terjual" yang sebenarnya.
        total_qty_sold: Number(p.total_qty_sold || 0),
        total_qty_base: Number(p.total_qty_base || 0),
        total_revenue: revenue,
        total_cogs: cogs,
        total_profit: profit,
        margin_percent:
          revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
      };
    });

    const summary = items.reduce(
      (acc, p) => {
        acc.total_qty_sold += p.total_qty_sold;
        acc.total_revenue += p.total_revenue;
        acc.total_cogs += p.total_cogs;
        acc.total_profit += p.total_profit;
        return acc;
      },
      { total_qty_sold: 0, total_revenue: 0, total_cogs: 0, total_profit: 0 },
    );
    summary.margin_percent =
      summary.total_revenue > 0
        ? Math.round((summary.total_profit / summary.total_revenue) * 10000) /
          100
        : 0;
    summary.total_products = items.length;

    return { startDate, endDate, summary, items };
  },

  async dashboardRevenueHistory(days) {
    const rows = await transactionModel.dashboardRevenueHistory(days);
    return (rows || []).map((row) => ({
      date: row.date,
      tx_count: Number(row.tx_count || 0),
      revenue: Number(row.revenue || 0),
    }));
  },

  /**
   * Ringkasan dashboard untuk rentang tanggal BEBAS (custom range, satu
   * tahun tertentu, dsb). Dipakai oleh filter tanggal fleksibel di halaman
   * Dashboard — beda dari dashboardSummary() yang selalu memakai patokan
   * tetap (hari ini/minggu ini/bulan berjalan).
   */
  async dashboardPeriodSummary({ start_date, end_date }) {
    const accountingModel = require("../models/accountingModel");
    const { startDate, endDate } = defaultDateRange(start_date, end_date);

    const [
      revenueHistory,
      salesSummary,
      topProducts,
      expensesByCategory,
      totalExpenses,
    ] = await Promise.all([
      transactionModel.revenueHistoryRange(startDate, endDate),
      transactionModel.salesSummary(startDate, endDate),
      transactionModel.topProducts(startDate, endDate, 5),
      accountingModel.expensesGroupedByCategory(startDate, endDate),
      accountingModel.totalExpensesInPeriod(startDate, endDate),
    ]);

    return {
      startDate,
      endDate,
      revenue: Number(salesSummary?.total_revenue || 0),
      txCount: Number(salesSummary?.total_transactions || 0),
      avgTransaction: Number(salesSummary?.avg_transaction || 0),
      revenueHistory: (revenueHistory || []).map((row) => ({
        date: row.date,
        tx_count: Number(row.tx_count || 0),
        revenue: Number(row.revenue || 0),
      })),
      topProducts: (topProducts || []).map((row) => ({
        name: row.name,
        category: row.category,
        base_unit: row.base_unit,
        // qty dalam satuan dasar (mis. kg), bukan sekadar jumlah baris terjual
        qty: Number(row.total_qty_base || 0),
        revenue: Number(row.total_revenue || 0),
      })),
      expensesByCategory: (expensesByCategory || []).map((row) => ({
        category: row.category,
        total: Number(row.total || 0),
        entry_count: Number(row.entry_count || 0),
      })),
      expensesTotal: Number(totalExpenses?.total_expenses || 0),
    };
  },

  async dashboardSummary() {
    const productModel = require("../models/productModel");
    const accountingModel = require("../models/accountingModel");
    const receivableModel = require("../models/receivableModel");
    const payableModel = require("../models/payableModel");
    const cashRegisterService = require("./cashRegisterService");

    const firstDayOfThisMonth = new Date();
    firstDayOfThisMonth.setDate(1);
    const startOfMonth = firstDayOfThisMonth.toISOString().split("T")[0];
    const endOfToday = new Date().toISOString().split("T")[0];

    const [
      today,
      yesterday,
      thisWeek,
      thisMonth,
      last7Days,
      lowStock,
      totalProducts,
      inventory,
      receivablesSummary,
      payablesSummary,
      activeCashShift,
      expensesThisMonth,
      topProducts,
      expensesByCategory,
      reorderPoints,
    ] = await Promise.all([
      transactionModel.dashboardToday(),
      transactionModel.dashboardYesterday(),
      transactionModel.dashboardThisWeek(),
      transactionModel.dashboardThisMonth(),
      transactionModel.dashboardLast7Days(),
      productModel.findAll({ lowStockOnly: true }),
      productModel.findAll({}),
      productModel.sumInventoryValue(),
      receivableModel.summary(),
      payableModel.summary(),
      cashRegisterService.getActiveShift(),
      accountingModel.totalExpensesInPeriod(startOfMonth, endOfToday),
      transactionModel.topProducts(startOfMonth, endOfToday, 5),
      accountingModel.expensesGroupedByCategory(startOfMonth, endOfToday),
      // Reorder Point (ROP) SENGAJA dihitung terpisah dari low stock (min_stock)
      // di atas — keduanya metrik berbeda (lihat komentar productService.
      // listReorderPoints). Jangan digabung jadi satu angka MAX(), supaya
      // toko tetap bisa membaca dua sinyal restock yang berbeda maknanya.
      productService.listReorderPoints({ days: 30 }),
    ]);

    const toSafe = (row) => ({
      tx_count: Number(row?.tx_count || 0),
      revenue: Number(row?.revenue || 0),
    });

    return {
      today: toSafe(today),
      yesterday: toSafe(yesterday),
      thisWeek: toSafe(thisWeek),
      thisMonth: toSafe(thisMonth),
      last7Days: last7Days || [],
      // Stok Menipis: stok <= min_stock (ambang manual per produk).
      lowStockCount: lowStock.length,
      // Perlu Reorder: stok <= Reorder Point (dihitung dari rata-rata
      // penjualan, lead time, & safety stock — hanya produk yang lead
      // time-nya sudah diisi di halaman Produk). Metrik terpisah dari
      // lowStockCount, tidak digabung.
      needsReorderCount: reorderPoints.filter((p) => p.needs_reorder).length,
      reorderMonitoredCount: reorderPoints.length,
      totalProducts: totalProducts.length,
      // Nilai persediaan berjalan (dihitung dari stok x harga saat ini).
      inventoryValueAtCost: Number(inventory?.inventory_value_at_cost || 0),
      inventoryValueAtRetail: Number(inventory?.inventory_value_at_retail || 0),
      // Piutang pelanggan (Open Bill) yang belum tertagih.
      receivablesOutstanding: Number(receivablesSummary?.total_piutang || 0),
      receivablesOverdue: Number(receivablesSummary?.total_jatuh_tempo || 0),
      // Hutang ke pemasok (faktur pembelian) yang belum dibayar.
      payablesOutstanding: Number(payablesSummary?.total_hutang || 0),
      payablesOverdue: Number(payablesSummary?.total_jatuh_tempo || 0),
      // Saldo kas berjalan dari sesi kas yang sedang terbuka (0 jika kas belum dibuka).
      cashBalance: activeCashShift
        ? Number(activeCashShift.expected_balance || 0)
        : 0,
      cashShiftOpen: !!activeCashShift,
      // Total pengeluaran (beban operasional) bulan berjalan.
      expensesThisMonth: Number(expensesThisMonth?.total_expenses || 0),
      // Beban perusahaan bulan berjalan, dikelompokkan per kategori.
      expensesByCategory: (expensesByCategory || []).map((row) => ({
        category: row.category,
        total: Number(row.total || 0),
        entry_count: Number(row.entry_count || 0),
      })),
      // Produk terlaris bulan berjalan (berdasarkan omzet).
      // qty dalam satuan dasar (mis. kg), bukan jumlah baris terjual.
      topProducts: (topProducts || []).map((row) => ({
        name: row.name,
        category: row.category,
        base_unit: row.base_unit,
        qty: Number(row.total_qty_base || 0),
        revenue: Number(row.total_revenue || 0),
      })),
    };
  },
};

module.exports = {
  transactionService,
  defaultDateRange,
  toLocalDatetime,
  generateTransactionCode,
};
