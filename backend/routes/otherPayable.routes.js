// routes/otherPayable.routes.js
// Modul Pinjaman Bank & Utang Lainnya — khusus ADMIN, di-mount dengan prefix
// "/other-payables" di routes/index.js (authorize("admin") dipasang di
// titik mount, mirror payable.routes.js).
const express = require("express");
const router = express.Router();
const otherPayableController = require("../controllers/otherPayableController");

// Laporan — didaftarkan sebelum "/:id" supaya tidak tertangkap sebagai id
router.get("/summary", otherPayableController.getSummary);

router.get("/", otherPayableController.getAll);
router.get("/:id", otherPayableController.getById);
router.post("/", otherPayableController.create);
router.post("/:id/payments", otherPayableController.recordPayment);
router.delete("/:id", otherPayableController.remove);

module.exports = router;
