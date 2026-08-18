// controllers/receivableController.js
const { asyncHandler } = require("./_helpers");
const receivableService = require("../services/receivableService");

exports.getAll = asyncHandler(async (req, res) => {
  const result = await receivableService.list(req.query);
  res.json({ success: true, data: result });
});

exports.getById = asyncHandler(async (req, res) => {
  const data = await receivableService.getById(req.params.id);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await receivableService.create({
    ...req.body,
    recorded_by: req.user?.name || "Admin",
  });
  res
    .status(201)
    .json({ success: true, data, message: "Piutang berhasil dicatat" });
});

exports.remove = asyncHandler(async (req, res) => {
  await receivableService.remove(req.params.id);
  res.json({ success: true, message: "Piutang berhasil dihapus" });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const data = await receivableService.recordPayment(
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
    message: "Pembayaran piutang berhasil dicatat",
  });
});

// ─── Laporan ────────────────────────────────────────────────────────────
exports.getUnpaidInvoices = asyncHandler(async (req, res) => {
  const data = await receivableService.unpaidInvoices(req.query.customer_id);
  res.json({ success: true, data });
});

exports.getUnpaidByCustomer = asyncHandler(async (req, res) => {
  const data = await receivableService.unpaidByCustomer();
  res.json({ success: true, data });
});

exports.getAging = asyncHandler(async (req, res) => {
  const data = await receivableService.aging();
  res.json({ success: true, data });
});

exports.getHistory = asyncHandler(async (req, res) => {
  const data = await receivableService.history(req.query);
  res.json({ success: true, data });
});

exports.getSummary = asyncHandler(async (req, res) => {
  const data = await receivableService.summary();
  res.json({ success: true, data });
});
