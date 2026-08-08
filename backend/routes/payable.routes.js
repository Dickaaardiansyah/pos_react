// routes/payable.routes.js
// Modul Hutang — khusus ADMIN, di-mount dengan prefix "/payables" di
// routes/index.js (authorize("admin") dipasang di titik mount).
const express = require("express");
const router = express.Router();
const payableController = require("../controllers/payableController");

// Laporan — didaftarkan sebelum "/:id" supaya tidak tertangkap sebagai id
router.get("/unpaid", payableController.getUnpaidInvoices);
router.get("/unpaid-per-supplier", payableController.getUnpaidBySupplier);
router.get("/aging", payableController.getAging);
router.get("/history", payableController.getHistory);
router.get("/summary", payableController.getSummary);

router.get("/", payableController.getAll);
router.get("/:id", payableController.getById);
router.post("/", payableController.create);
router.post("/:id/payments", payableController.recordPayment);
router.delete("/:id", payableController.remove);

module.exports = router;
