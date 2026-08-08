// controllers/journalController.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER LAYER — menerjemahkan request HTTP modul Jurnal Akuntansi ke
// service layer: Chart of Accounts, Jurnal Umum, Buku Besar, Neraca Saldo.
// ─────────────────────────────────────────────────────────────────────────────
const { asyncHandler } = require("./_helpers");
const journalService = require("../services/journalService");

// ─── Chart of Accounts ───────────────────────────────────────────────────
exports.getAccounts = asyncHandler(async (req, res) => {
  const accounts = await journalService.listAccounts(req.query);
  res.json({ success: true, data: accounts });
});

exports.createAccount = asyncHandler(async (req, res) => {
  const account = await journalService.createAccount(req.body);
  res
    .status(201)
    .json({ success: true, data: account, message: "Akun berhasil dibuat" });
});

exports.updateAccount = asyncHandler(async (req, res) => {
  const account = await journalService.updateAccount(req.params.id, req.body);
  res.json({
    success: true,
    data: account,
    message: "Akun berhasil diperbarui",
  });
});

// ─── Jurnal Umum ─────────────────────────────────────────────────────────
exports.getEntries = asyncHandler(async (req, res) => {
  const result = await journalService.list(req.query);
  res.json({ success: true, ...result });
});

exports.getEntryDetail = asyncHandler(async (req, res) => {
  const entry = await journalService.getEntryDetail(req.params.id);
  res.json({ success: true, data: entry });
});

exports.createManualEntry = asyncHandler(async (req, res) => {
  const entry = await journalService.postManualEntry(req.body);
  res
    .status(201)
    .json({ success: true, data: entry, message: "Jurnal berhasil diposting" });
});

exports.deleteEntry = asyncHandler(async (req, res) => {
  await journalService.deleteEntry(req.params.id);
  res.json({ success: true, message: "Jurnal dihapus" });
});

// ─── Buku Besar ──────────────────────────────────────────────────────────
exports.getGeneralLedger = asyncHandler(async (req, res) => {
  const ledger = await journalService.generalLedger(req.query);
  res.json({ success: true, data: ledger });
});

// ─── Neraca Saldo ────────────────────────────────────────────────────────
exports.getTrialBalance = asyncHandler(async (req, res) => {
  const trialBalance = await journalService.trialBalance(req.query);
  res.json({ success: true, data: trialBalance });
});

// ─── Laporan Arus Kas ────────────────────────────────────────────────────
exports.getCashFlowReport = asyncHandler(async (req, res) => {
  const report = await journalService.cashFlowReport(req.query);
  res.json({ success: true, data: report });
});
