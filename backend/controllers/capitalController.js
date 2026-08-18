// controllers/capitalController.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER LAYER — menerjemahkan request HTTP modul Modal Usaha ke service
// layer: input Modal Awal/setoran/penarikan, riwayat, dan ringkasan ekuitas.
// ─────────────────────────────────────────────────────────────────────────────
const { asyncHandler } = require("./_helpers");
const capitalService = require("../services/capitalService");

exports.getSummary = asyncHandler(async (req, res) => {
  const summary = await capitalService.summary(req.query);
  res.json({ success: true, data: summary });
});

exports.getTransactions = asyncHandler(async (req, res) => {
  const result = await capitalService.list(req.query);
  res.json({ success: true, ...result });
});

exports.createTransaction = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    recorded_by: req.user?.name || req.body.recorded_by,
  };
  const tx = await capitalService.record(payload, req.user);
  res.status(201).json({
    success: true,
    data: tx,
    message: payload.is_initial
      ? "Modal awal berhasil dicatat"
      : "Transaksi modal berhasil dicatat",
  });
});
