// controllers/stockOpnameController.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER LAYER — menerjemahkan request HTTP Stock Opname ke service layer.
// ─────────────────────────────────────────────────────────────────────────────
const { asyncHandler } = require("./_helpers");
const stockOpnameService = require("../services/stockOpnameService");

exports.getProductsForOpname = asyncHandler(async (req, res) => {
  const products = await stockOpnameService.listProducts(req.query);
  res.json({ success: true, data: products });
});

exports.createSession = asyncHandler(async (req, res) => {
  const session = await stockOpnameService.createSession(req.body, req.user);
  res.status(201).json({
    success: true,
    data: session,
    message: "Stock opname berhasil disimpan, stok sistem telah disesuaikan",
  });
});

exports.getAllSessions = asyncHandler(async (req, res) => {
  const result = await stockOpnameService.list(req.query);
  res.json({ success: true, ...result });
});

exports.getSessionById = asyncHandler(async (req, res) => {
  const session = await stockOpnameService.getDetail(req.params.id);
  res.json({ success: true, data: session });
});
