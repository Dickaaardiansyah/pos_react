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
  const shift = await cashRegisterService.getActiveShift(req.user);
  res.json({ success: true, data: shift });
});

exports.getOpenShifts = asyncHandler(async (req, res) => {
  const shifts = await cashRegisterService.listOpenShifts();
  res.json({ success: true, data: shifts });
});

// FIX KEAMANAN: req.user (hasil verifikasi JWT oleh middleware authenticate)
// diteruskan ke service sebagai sumber identitas kasir — bukan lagi
// req.body.opened_by / created_by / closed_by yang bisa diisi bebas oleh
// klien. Lihat services/cashRegisterService.js untuk penegakan kepemilikan.
exports.openShift = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.openShift(req.body, req.user);
  res
    .status(201)
    .json({ success: true, data: shift, message: "Kas berhasil dibuka" });
});

exports.createMovement = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.createMovement(req.body, req.user);
  const message =
    req.body.type === "out"
      ? "Pengeluaran kas berhasil dicatat"
      : "Pemasukan kas berhasil dicatat";
  res.status(201).json({ success: true, data: shift, message });
});

exports.deleteMovement = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.deleteMovement(
    req.params.id,
    req.user,
  );
  res.json({ success: true, data: shift, message: "Catatan kas dihapus" });
});

exports.closeShift = asyncHandler(async (req, res) => {
  const shift = await cashRegisterService.closeShift(
    req.params.id,
    req.body,
    req.user,
  );
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
