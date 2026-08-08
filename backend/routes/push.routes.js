// backend/routes/push.routes.js
const express = require("express");
const router = express.Router();
const pushController = require("../controllers/pushController");

// Seluruh route di sini di-mount dengan authorize("admin") di routes/index.js
// — sama seperti /notifications, karena saat ini fitur notifikasi stok/ROP
// murni kebutuhan admin.
router.get("/public-key", pushController.getPublicKey);
router.post("/subscribe", pushController.subscribe);
router.post("/unsubscribe", pushController.unsubscribe);

module.exports = router;
