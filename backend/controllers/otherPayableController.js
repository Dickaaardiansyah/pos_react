// controllers/otherPayableController.js
const { asyncHandler } = require("./_helpers");
const otherPayableService = require("../services/otherPayableService");

exports.getAll = asyncHandler(async (req, res) => {
  const data = await otherPayableService.list(req.query);
  res.json({ success: true, data });
});

exports.getById = asyncHandler(async (req, res) => {
  const data = await otherPayableService.getById(req.params.id);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await otherPayableService.create({
    ...req.body,
    recorded_by: req.user?.name || "Admin",
  });
  res
    .status(201)
    .json({ success: true, data, message: "Pinjaman/utang berhasil dicatat" });
});

exports.remove = asyncHandler(async (req, res) => {
  await otherPayableService.remove(req.params.id);
  res.json({ success: true, message: "Pinjaman/utang berhasil dihapus" });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const data = await otherPayableService.recordPayment(req.params.id, {
    ...req.body,
    recorded_by: req.user?.name || "Admin",
  });
  res.json({
    success: true,
    data,
    message: "Pembayaran cicilan berhasil dicatat",
  });
});

exports.getSummary = asyncHandler(async (req, res) => {
  const data = await otherPayableService.summary();
  res.json({ success: true, data });
});
