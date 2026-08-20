// routes/transaction.routes.js
const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const voidRequestController = require("../controllers/voidRequestController");
const { authorize } = require("../middleware/auth");

// Kasir: buat transaksi baru & lihat riwayat penjualan.
// FIX (review dosen): checkout sebelumnya tidak dibatasi authorize() sama
// sekali — admin pun bisa POST /transactions langsung lewat API selama ADA
// sesi kas 'open' milik siapa pun (celah "checkout pakai shift kasir lain").
// Service layer (transactionService.checkout) sudah diperbaiki untuk hanya
// mengambil shift 'open' MILIK user yang login (findActiveShift(user.id)),
// tapi itu saja tidak cukup: tanpa authorize("cashier") di sini, admin yang
// TIDAK memegang shift apa pun tetap lolos ke service, dan kalau admin itu
// kebetulan juga pernah membuka shift (legacy/edge case), checkout-nya akan
// tercatat atas nama admin sendiri — bukan lagi "pakai shift kasir lain",
// tapi tetap salah karena admin memang tidak boleh ikut checkout di POS
// sama sekali (konsisten dengan pembatasan modul Kas Kecil di
// cashRegister.routes.js: admin tidak pegang kas berjalan).
router.post(
  "/transactions",
  authorize("cashier"),
  transactionController.createTransaction,
);
router.get(
  "/transactions",
  authorize("admin", "cashier"),
  transactionController.getAllTransactions,
);
router.get(
  "/transactions/:id",
  authorize("admin", "cashier"),
  transactionController.getTransactionById,
);

// Batal (void) transaksi LANGSUNG — ADMIN SAJA. Kasir tidak lagi diizinkan
// membatalkan langsung (lihat review dosen: tidak ada pemeriksaan pemilik
// transaksi/shift/tanggal/persetujuan sebelumnya) — kasir wajib lewat alur
// pengajuan void_requests di bawah, yang butuh persetujuan admin.
// Mengembalikan stok, membalik jurnal, dan membatalkan piutang Open Bill
// terkait (transactionModel.voidTransaction — tidak diubah).
router.post(
  "/transactions/:id/void",
  authorize("admin"),
  transactionController.voidTransaction,
);

// ─── Alur Persetujuan Void (Void Approval) — lihat services/voidRequestService.js ─
// Kasir mengajukan pembatalan transaksi miliknya sendiri; admin menyetujui
// atau menolak. Validasi kepemilikan/shift/tanggal/status akun ada di
// service layer, bukan di sini.
router.post(
  "/transactions/:id/void-requests",
  authorize("admin", "cashier"),
  voidRequestController.createRequest,
);
router.get(
  "/void-requests",
  authorize("admin", "cashier"),
  voidRequestController.listRequests,
);
router.post(
  "/void-requests/:id/approve",
  authorize("admin"),
  voidRequestController.approveRequest,
);
router.post(
  "/void-requests/:id/reject",
  authorize("admin"),
  voidRequestController.rejectRequest,
);

// Laporan penjualan & dashboard ringkasan bisnis — khusus admin.
router.get(
  "/reports/sales-daily",
  authorize("admin"),
  transactionController.getDailySalesReport,
);
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
  "/reports/payment-method",
  authorize("admin"),
  transactionController.getPaymentMethodReport,
);
router.get(
  "/reports/void",
  authorize("admin"),
  transactionController.getVoidReport,
);
router.get(
  "/cashiers",
  authorize("admin", "cashier"),
  transactionController.listCashiers,
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