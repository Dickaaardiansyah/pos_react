// routes/journal.routes.js
// Modul Jurnal Akuntansi Otomatis: Chart of Accounts, Jurnal Umum, Buku Besar,
// Neraca Saldo — seluruhnya khusus ADMIN. Di-mount dengan prefix "/journal"
// + authorize("admin") di routes/index.js.
const express = require("express");
const router = express.Router();
const journalController = require("../controllers/journalController");

router.get("/accounts", journalController.getAccounts);
router.post("/accounts", journalController.createAccount);
router.put("/accounts/:id", journalController.updateAccount);

router.get("/entries", journalController.getEntries);
router.post("/entries", journalController.createManualEntry);
router.get("/entries/:id", journalController.getEntryDetail);
router.delete("/entries/:id", journalController.deleteEntry);
router.post("/entries/:id/reverse", journalController.reverseEntry);

router.get("/adjustment-templates", journalController.getAdjustmentTemplates);
router.post("/adjustments", journalController.createAdjustingEntry);

router.get("/ledger", journalController.getGeneralLedger);
router.get("/trial-balance", journalController.getTrialBalance);
router.get("/balance-sheet", journalController.getBalanceSheet);
router.get("/cash-flow", journalController.getCashFlowReport);
router.get("/system-validation", journalController.getSystemValidation);
router.get("/cash-balances", journalController.getCashBalances);

module.exports = router;
