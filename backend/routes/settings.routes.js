// routes/settings.routes.js
// Pengaturan toko, manajemen pengguna, dan ekspor data — khusus ADMIN,
// KECUALI GET /settings yang juga dipakai kasir (mis. cetak struk butuh
// nama/alamat toko). authorize("admin") dipasang PER-ROUTE (bukan lewat
// router.use blanket) supaya tidak ikut menghalangi request ke router lain
// (mis. /cash-register/*, /customers/*) yang di-mount setelah router ini.
const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { authorize } = require("../middleware/auth");

const adminOnly = authorize("admin");

router.get("/settings", settingsController.getSettings);
router.put("/settings", adminOnly, settingsController.updateSettings);

router.get("/users", adminOnly, settingsController.getUsers);
router.post("/users", adminOnly, settingsController.createUser);
router.put("/users/:id", adminOnly, settingsController.updateUser);
router.delete("/users/:id", adminOnly, settingsController.deleteUser);

router.get(
  "/export/transactions",
  adminOnly,
  settingsController.exportTransactionsCSV,
);
router.get("/export/products", adminOnly, settingsController.exportProductsCSV);

module.exports = router;
