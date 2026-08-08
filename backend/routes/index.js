// backend/routes/index.js
// Menggabungkan seluruh router per-domain menjadi satu router utama.
//
// PENTING soal urutan & scoping middleware: router yang isinya campuran
// (boleh admin & kasir, dibedakan per-route — mis. product/transaction/
// cashRegister/settings) di-mount TANPA prefix supaya path aslinya tetap
// sama, dan authorize("admin") dipasang di masing-masing route di dalamnya.
// Router yang SELURUH isinya khusus admin (accounting/stock-opname/
// stock-mutations/journal) di-mount DENGAN prefix path tertentu supaya
// authorize("admin") yang dipasang di titik mount hanya berlaku untuk
// path tersebut dan tidak "bocor" menghalangi request ke router lain yang
// di-mount setelahnya.
const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/auth");

router.use(require("./product.routes"));
router.use(require("./transaction.routes"));
router.use(require("./purchase.routes"));
router.use(require("./settings.routes"));
router.use(require("./cashRegister.routes"));
router.use(require("./customer.routes"));

router.use("/accounting", authorize("admin"), require("./accounting.routes"));
router.use(
  "/stock-opname",
  authorize("admin"),
  require("./stockOpname.routes"),
);
router.use(
  "/stock-mutations",
  authorize("admin"),
  require("./stockMutation.routes"),
);
router.use("/journal", authorize("admin"), require("./journal.routes"));
router.use("/capital", authorize("admin"), require("./capital.routes"));
// Piutang/Open Bill: kasir juga perlu akses untuk menerima pembayaran saat
// pelanggan datang membayar tagihan, jadi tidak admin-only seperti modul
// akuntansi lainnya.
router.use(
  "/receivables",
  authorize("admin", "cashier"),
  require("./receivable.routes"),
);
router.use("/payables", authorize("admin"), require("./payable.routes"));
router.use(
  "/notifications",
  authorize("admin"),
  require("./notification.routes"),
);
router.use("/push", authorize("admin"), require("./push.routes"));

module.exports = router;
