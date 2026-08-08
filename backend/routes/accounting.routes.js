// routes/accounting.routes.js
// Modul akuntansi: biaya operasional & Laporan Laba Rugi — seluruhnya khusus
// ADMIN. Router ini di-mount di routes/index.js dengan prefix "/accounting"
// dan authorize("admin") diterapkan pada saat mounting (lihat routes/index.js),
// sehingga pembatasan hanya berlaku untuk path "/accounting/*" dan TIDAK
// bocor ke router lain yang di-mount setelahnya.
const express = require("express");
const router = express.Router();
const accountingController = require("../controllers/accountingController");

router.get("/expense-categories", accountingController.getExpenseCategories);
router.get("/expenses", accountingController.getExpenses);
router.post("/expenses", accountingController.createExpense);
router.put("/expenses/:id", accountingController.updateExpense);
router.delete("/expenses/:id", accountingController.deleteExpense);

router.get("/income-statement", accountingController.getIncomeStatement);
router.get(
  "/income-statement/multi-year",
  accountingController.getMultiYearIncomeStatement,
);
router.get(
  "/income-statement/quarterly",
  accountingController.getQuarterlyIncomeStatement,
);
router.get(
  "/income-statement/multi-period",
  accountingController.getMultiPeriodIncomeStatement,
);
router.get(
  "/income-statement/comparison",
  accountingController.getComparisonIncomeStatement,
);
router.get("/monthly-trend", accountingController.getMonthlyTrend);

module.exports = router;
