// routes/receivable.routes.js
// Modul Piutang / Open Bill — bisa diakses ADMIN dan KASIR (kasir perlu
// menerima pembayaran saat pelanggan datang membayar tagihan Open Bill),
// di-mount dengan prefix "/receivables" di routes/index.js
// (authorize("admin","cashier") dipasang di titik mount).
const express = require("express");
const router = express.Router();
const receivableController = require("../controllers/receivableController");

// Laporan — didaftarkan sebelum "/:id" supaya tidak tertangkap sebagai id
router.get("/unpaid", receivableController.getUnpaidInvoices);
router.get("/unpaid-per-customer", receivableController.getUnpaidByCustomer);
router.get("/aging", receivableController.getAging);
router.get("/history", receivableController.getHistory);
router.get("/summary", receivableController.getSummary);

router.get("/", receivableController.getAll);
router.get("/:id", receivableController.getById);
router.post("/", receivableController.create);
router.post("/:id/payments", receivableController.recordPayment);
router.delete("/:id", receivableController.remove);

module.exports = router;
