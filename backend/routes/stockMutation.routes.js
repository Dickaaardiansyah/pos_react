// routes/stockMutation.routes.js
// Modul Mutasi Stok — seluruhnya khusus ADMIN. Di-mount dengan prefix
// "/stock-mutations" + authorize("admin") di routes/index.js.
const express = require("express");
const router = express.Router();
const stockMutationController = require("../controllers/stockMutationController");

router.get("/jenis", stockMutationController.getJenisOptions);
router.get("/summary", stockMutationController.getSummary);
router.get("/", stockMutationController.getMutations);

module.exports = router;
