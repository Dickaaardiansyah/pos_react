// controllers/stockMutationController.js
const { asyncHandler } = require("./_helpers");
const stockMutationService = require("../services/stockMutationService");

exports.getJenisOptions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: stockMutationService.jenisOptions() });
});

exports.getMutations = asyncHandler(async (req, res) => {
  const result = await stockMutationService.list(req.query);
  res.json({ success: true, ...result });
});

exports.getSummary = asyncHandler(async (req, res) => {
  const result = await stockMutationService.summary(req.query);
  res.json({ success: true, data: result });
});
