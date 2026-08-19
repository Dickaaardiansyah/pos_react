// routes/capital.routes.js
// Modul Modal Usaha: Modal Awal, setoran/penarikan modal, ringkasan ekuitas —
// seluruhnya khusus ADMIN. Di-mount dengan prefix "/capital" +
// authorize("admin") di routes/index.js.
const express = require("express");
const router = express.Router();
const capitalController = require("../controllers/capitalController");

router.get("/summary", capitalController.getSummary);
router.get("/equity-statement", capitalController.getEquityStatement);
router.get("/transactions", capitalController.getTransactions);
router.post("/transactions", capitalController.createTransaction);

module.exports = router;
