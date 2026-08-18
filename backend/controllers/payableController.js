// controllers/payableController.js
const { asyncHandler } = require("./_helpers");
const payableService = require("../services/payableService");

exports.getAll = asyncHandler(async (req, res) => {
  const result = await payableService.list(req.query);
  res.json({ success: true, data: result });
});

exports.getById = asyncHandler(async (req, res) => {
  const data = await payableService.getById(req.params.id);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await payableService.create({
    ...req.body,
    recorded_by: req.user?.name || "Admin",
  });
  res
    .status(201)
    .json({ success: true, data, message: "Hutang berhasil dicatat" });
});

exports.remove = asyncHandler(async (req, res) => {
  await payableService.remove(req.params.id);
  res.json({ success: true, message: "Hutang berhasil dihapus" });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const data = await payableService.recordPayment(
    req.params.id,
    {
      ...req.body,
      recorded_by: req.user?.name || "Admin",
    },
    req.user,
  );
  res.json({
    success: true,
    data,
    message: "Pembayaran hutang berhasil dicatat",
  });
});

// ─── Laporan ────────────────────────────────────────────────────────────
exports.getUnpaidInvoices = asyncHandler(async (req, res) => {
  const data = await payableService.unpaidInvoices();
  res.json({ success: true, data });
});

exports.getUnpaidBySupplier = asyncHandler(async (req, res) => {
  const data = await payableService.unpaidBySupplier();
  res.json({ success: true, data });
});

exports.getAging = asyncHandler(async (req, res) => {
  const data = await payableService.aging();
  res.json({ success: true, data });
});

exports.getHistory = asyncHandler(async (req, res) => {
  const data = await payableService.history(req.query);
  res.json({ success: true, data });
});

exports.getSummary = asyncHandler(async (req, res) => {
  const data = await payableService.summary();
  res.json({ success: true, data });
});
