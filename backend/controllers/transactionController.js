// controllers/transactionController.js
const { asyncHandler } = require("./_helpers");
const { transactionService } = require("../services/transactionService");

exports.createTransaction = asyncHandler(async (req, res) => {
  const result = await transactionService.checkout(req.body);
  res
    .status(201)
    .json({ success: true, data: result, message: "Transaksi berhasil" });
});

exports.getAllTransactions = asyncHandler(async (req, res) => {
  const result = await transactionService.list(req.query);
  res.json({ success: true, ...result });
});

exports.getTransactionById = asyncHandler(async (req, res) => {
  const detail = await transactionService.getDetail(req.params.id);
  res.json({ success: true, data: detail });
});

exports.voidTransaction = asyncHandler(async (req, res) => {
  const result = await transactionService.voidTransaction(req.params.id, {
    reason: req.body.reason,
    voided_by: req.user?.name || req.user?.username,
  });
  res.json({
    success: true,
    data: result,
    message: "Transaksi berhasil dibatalkan",
  });
});

exports.getSalesReport = asyncHandler(async (req, res) => {
  const report = await transactionService.salesReport(req.query);
  res.json({ success: true, data: report });
});

exports.getProductProfitReport = asyncHandler(async (req, res) => {
  const report = await transactionService.productProfitReport(req.query);
  res.json({ success: true, data: report });
});

exports.getSalesByCustomerReport = asyncHandler(async (req, res) => {
  const report = await transactionService.salesByCustomerReport(req.query);
  res.json({ success: true, data: report });
});

exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await transactionService.dashboardSummary();
  res.json({ success: true, data: summary });
});

// Ringkasan dashboard untuk rentang tanggal fleksibel yang dipilih user
// (custom range, tahun tertentu, dsb) — dipakai oleh filter tanggal
// fleksibel dan tombol ekspor PDF/Excel di halaman Dashboard.
exports.getDashboardPeriodSummary = asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  const summary = await transactionService.dashboardPeriodSummary({
    start_date,
    end_date,
  });
  res.json({ success: true, data: summary });
});

// Riwayat pendapatan/transaksi harian untuk rentang waktu yang bisa dipilih
// user di grafik dashboard (mis. 7, 14, atau 30 hari terakhir).
exports.getDashboardRevenueHistory = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 7;
  const clampedDays = Math.min(Math.max(days, 1), 90);
  const history = await transactionService.dashboardRevenueHistory(clampedDays);
  res.json({ success: true, data: history });
});
