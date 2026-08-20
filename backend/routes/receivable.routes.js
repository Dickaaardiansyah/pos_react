// routes/receivable.routes.js
// Modul Piutang / Open Bill — bisa diakses ADMIN dan KASIR (kasir perlu
// menerima pembayaran saat pelanggan datang membayar tagihan Open Bill),
// di-mount dengan prefix "/receivables" di routes/index.js
// (authorize("admin","cashier") dipasang di titik mount).
//
// FIX (revisi dosen #9): sebelumnya SELURUH endpoint di bawah "/receivables"
// ikut terbuka untuk kasir hanya karena authorize("admin","cashier") dipasang
// di titik mount, termasuk POST "/" (buat piutang manual) — padahal piutang
// manual memposting jurnal Dr Piutang Usaha, Cr Saldo Awal/Penyesuaian yang
// memengaruhi General Ledger & ekuitas, sesuatu yang seharusnya bukan
// kewenangan kasir. Kasir cukup: GET open bills, GET detail, POST payment.
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

// Laporan — didaftarkan sebelum "/:id" supaya tidak tertangkap sebagai id
router.get("/unpaid", receivableController.getUnpaidInvoices);
router.get("/unpaid-per-customer", receivableController.getUnpaidByCustomer);
router.get("/aging", receivableController.getAging);
router.get("/history", receivableController.getHistory);
router.get("/summary", receivableController.getSummary);

router.get("/", receivableController.getAll);
router.get("/:id", receivableController.getById);
router.post("/:id/payments", receivableController.recordPayment);
router.delete("/:id", adminOnly, receivableController.remove);

module.exports = router;
