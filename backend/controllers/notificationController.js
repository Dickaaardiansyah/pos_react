// controllers/notificationController.js
const { asyncHandler } = require("./_helpers");
const { notificationService } = require("../services/notificationService");

exports.list = asyncHandler(async (req, res) => {
  const { items, page, limit } = await notificationService.list(req.query);
  res.json({ success: true, data: items, page, limit });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount();
  res.json({ success: true, data: { count } });
});

exports.markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.params.id);
  res.json({ success: true, message: "Notifikasi ditandai sudah dibaca" });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead();
  res.json({ success: true, message: "Semua notifikasi ditandai sudah dibaca" });
});
