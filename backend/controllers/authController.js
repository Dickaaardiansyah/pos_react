// controllers/authController.js
const { asyncHandler } = require("./_helpers");
const { settingService } = require("../services/settingService");

exports.login = asyncHandler(async (req, res) => {
  const result = await settingService.login(req.body);
  res.json({ success: true, data: result, message: "Login berhasil" });
});

// Dipanggil frontend saat refresh halaman untuk memastikan token masih valid
// dan mengambil data user terbaru (mis. jika role diubah admin di tempat lain).
exports.me = asyncHandler(async (req, res) => {
  const user = await settingService.me(req.user.id);
  res.json({ success: true, data: user });
});
