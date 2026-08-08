// routes/stockOpname.routes.js
// Modul Stock Opname — seluruhnya khusus ADMIN. Di-mount dengan prefix
// "/stock-opname" + authorize("admin") di routes/index.js.
const express = require("express");
const router = express.Router();
const stockOpnameController = require("../controllers/stockOpnameController");

router.get("/products", stockOpnameController.getProductsForOpname);
router.get("/", stockOpnameController.getAllSessions);
router.post("/", stockOpnameController.createSession);
router.get("/:id", stockOpnameController.getSessionById);

module.exports = router;
