// routes/notification.routes.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// Seluruh route di sini di-mount dengan authorize("admin") di routes/index.js
// (notifikasi stok/ROP saat ini murni kebutuhan admin, sama seperti halaman
// Produk & Rekomendasi Restock).
router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.put("/:id/read", notificationController.markRead);
router.put("/read-all", notificationController.markAllRead);

module.exports = router;
