// controllers/cashRegisterController.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER LAYER — menerjemahkan request HTTP modul Kas Kecil (Cash
// Register) ke service layer.
// ─────────────────────────────────────────────────────────────────────────────
const { asyncHandler } = require("./_helpers");
const cashRegisterService = require("../services/cashRegisterService");

exports.getCashOutCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, data: cashRegisterService.cashOutCategories() });
});

exports.getCashInCategories = asyncHandler(async (req, res) => {
  res.json({ success: true, data: cashRegisterService.cashInCategories() });
});

exports.getReport = asyncHandler(async (req, res) => {
  const report = await cashRegisterService.report(req.query);
  res.json({ success: true, data: report });
});

exports.getActiveShift = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.getActiveShift();
  res.json({ success: true, data: shift });
});

exports.openShift = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.openShift(req.body);
  res
    .status(201)
    .json({ success: true, data: shift, message: "Kas berhasil dibuka" });
});

exports.createMovement = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.createMovement(req.body);
  const message =
    req.body.type === "out"
      ? "Pengeluaran kas berhasil dicatat"
      : "Pemasukan kas berhasil dicatat";
  res.status(201).json({ success: true, data: shift, message });
});

exports.deleteMovement = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.deleteMovement(req.params.id);
  res.json({ success: true, data: shift, message: "Catatan kas dihapus" });
});

exports.closeShift = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.closeShift(req.params.id, req.body);
  res.json({ success: true, data: shift, message: "Kas berhasil ditutup" });
});

exports.getHistory = asyncHandler(async (req, res) => {
  const result = await cashRegisterService.history(req.query);
  res.json({ success: true, ...result });
});

exports.getShiftDetail = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.getShiftDetail(req.params.id);
  res.json({ success: true, data: shift });
});
