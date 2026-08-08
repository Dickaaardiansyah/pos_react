// routes/transaction.routes.js
const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { authorize } = require("../middleware/auth");

// Kasir: buat transaksi baru & lihat riwayat penjualan.
router.post("/transactions", transactionController.createTransaction);
router.get("/transactions", transactionController.getAllTransactions);
router.get("/transactions/:id", transactionController.getTransactionById);

// Batal (void) transaksi — admin & kasir, wajib isi alasan. Mengembalikan
// stok, membalik jurnal, dan membatalkan piutang Open Bill terkait.
router.post(
  "/transactions/:id/void",
  authorize("admin", "cashier"),
  transactionController.voidTransaction,
);

// Laporan penjualan & dashboard ringkasan bisnis — khusus admin.
router.get(
  "/reports/sales",
  authorize("admin"),
  transactionController.getSalesReport,
);
router.get(
  "/reports/product-profit",
  authorize("admin"),
  transactionController.getProductProfitReport,
);
router.get(
  "/reports/sales-by-customer",
  authorize("admin"),
  transactionController.getSalesByCustomerReport,
);
router.get(
  "/dashboard/summary",
  authorize("admin"),
  transactionController.getDashboardSummary,
);
router.get(
  "/dashboard/revenue-history",
  authorize("admin"),
  transactionController.getDashboardRevenueHistory,
);
router.get(
  "/dashboard/period-summary",
  authorize("admin"),
  transactionController.getDashboardPeriodSummary,
);

module.exports = router;
