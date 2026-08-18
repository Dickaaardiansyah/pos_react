// controllers/accountingController.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER LAYER — modul akuntansi baru (menggantikan modul AI/Gas/OCR
// yang dihapus): biaya operasional & Laporan Laba Rugi.
// ─────────────────────────────────────────────────────────────────────────────
const { asyncHandler } = require("./_helpers");
const accountingService = require("../services/accountingService");

exports.getExpenseCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, data: accountingService.expenseCategories() });
});

exports.getExpenses = asyncHandler(async (req, res) => {
  const expenses = await accountingService.listExpenses(req.query);
  res.json({ success: true, data: expenses });
});

exports.createExpense = asyncHandler(async (req, res) => {
  const expense = await accountingService.createExpense(req.body, req.user);
  res.status(201).json({
    success: true,
    data: expense,
    message: "Biaya operasional berhasil dicatat",
  });
});

exports.updateExpense = asyncHandler(async (req, res) => {
  const expense = await accountingService.updateExpense(
    req.params.id,
    req.body,
  );
  res.json({
    success: true,
    data: expense,
    message: "Biaya operasional berhasil diperbarui",
  });
});

exports.deleteExpense = asyncHandler(async (req, res) => {
  await accountingService.deleteExpense(req.params.id);
  res.json({ success: true, message: "Biaya operasional dihapus" });
});

exports.getIncomeStatement = asyncHandler(async (req, res) => {
  const statement = await accountingService.incomeStatement(req.query);
  res.json({ success: true, data: statement });
});

exports.getMonthlyTrend = asyncHandler(async (req, res) => {
  const trend = await accountingService.monthlyTrend();
  res.json({ success: true, data: trend });
});

exports.getMultiYearIncomeStatement = asyncHandler(async (req, res) => {
  const data = await accountingService.multiYearIncomeStatement(req.query);
  res.json({ success: true, data });
});

exports.getQuarterlyIncomeStatement = asyncHandler(async (req, res) => {
  const data = await accountingService.quarterlyIncomeStatement(req.query);
  res.json({ success: true, data });
});

exports.getMultiPeriodIncomeStatement = asyncHandler(async (req, res) => {
  const data = await accountingService.multiPeriodIncomeStatement(req.query);
  res.json({ success: true, data });
});

exports.getComparisonIncomeStatement = asyncHandler(async (req, res) => {
  const data = await accountingService.comparisonIncomeStatement(req.query);
  res.json({ success: true, data });
});
