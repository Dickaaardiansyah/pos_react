// routes/receivable.routes.js
// Modul Piutang / Open Bill — bisa diakses ADMIN dan KASIR (kasir perlu
// menerima pembayaran saat pelanggan datang membayar tagihan Open Bill),
// di-mount dengan prefix "/receivables" di routes/index.js
// (authorize("admin","cashier") dipasang di titik mount).
//
//
// Endpoint pembuatan piutang manual (POST "/") sudah DIHAPUS SELURUHNYA
// (bukan cuma dibatasi admin-only) — Open Bill sekarang hanya boleh
// terbentuk otomatis dari transaksi Open Bill di Kasir
// (lihat transactionModel.checkout), tidak lagi bisa diinput manual oleh
// siapa pun termasuk admin. Kalau ada piutang lama/penyesuaian yang perlu
// dicatat, gunakan jurnal manual (modul Jurnal), bukan modul Piutang ini.
const express = require("express");
const router = express.Router();
const receivableController = require("../controllers/receivableController");
const { authorize } = require("../middleware/auth");

const adminOnly = authorize("admin");

router.get("/unpaid", receivableController.getUnpaidInvoices);
router.get(
  "/unpaid-per-customer",
  adminOnly,
  receivableController.getUnpaidByCustomer,
);
router.get("/aging", adminOnly, receivableController.getAging);
router.get("/history", adminOnly, receivableController.getHistory);
router.get("/summary", adminOnly, receivableController.getSummary);

router.get("/", receivableController.getAll);
router.get("/:id", receivableController.getById);
router.post("/:id/payments", receivableController.recordPayment);
router.delete("/:id", adminOnly, receivableController.remove);

module.exports = router;
