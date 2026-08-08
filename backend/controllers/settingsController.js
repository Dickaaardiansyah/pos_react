// controllers/settingsController.js
const { asyncHandler } = require("./_helpers");
const { settingService } = require("../services/settingService");

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await settingService.getAllSettings();
  res.json({ success: true, data: settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  await settingService.updateSettings(req.body);
  res.json({ success: true, message: "Pengaturan berhasil disimpan" });
});

exports.getUsers = asyncHandler(async (req, res) => {
  const users = await settingService.listUsers();
  res.json({ success: true, data: users });
});

exports.createUser = asyncHandler(async (req, res) => {
  const user = await settingService.createUser(req.body);
  res
    .status(201)
    .json({ success: true, data: user, message: "User berhasil dibuat" });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await settingService.updateUser(req.params.id, req.body);
  res.json({ success: true, data: user, message: "User berhasil diperbarui" });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  await settingService.deleteUser(req.params.id);
  res.json({ success: true, message: "User dinonaktifkan" });
});

exports.exportTransactionsCSV = asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  const csv = await settingService.exportTransactionsCSV(start_date, end_date);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="transaksi_${start_date || "semua"}_${end_date || "semua"}.csv"`,
  );
  res.send("\uFEFF" + csv);
});

exports.exportProductsCSV = asyncHandler(async (req, res) => {
  const csv = await settingService.exportProductsCSV();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="produk.csv"');
  res.send("\uFEFF" + csv);
});
