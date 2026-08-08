// routes/purchase.routes.js
// Modul Pembelian/Supplier — seluruhnya khusus ADMIN.
const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const { authorize } = require("../middleware/auth");
const uploadNota = require("../middleware/uploadNota");

const adminOnly = authorize("admin");

router.get("/suppliers", adminOnly, purchaseController.getAllSuppliers);
router.post("/suppliers", adminOnly, purchaseController.createSupplier);
router.put("/suppliers/:id", adminOnly, purchaseController.updateSupplier);
router.delete("/suppliers/:id", adminOnly, purchaseController.deleteSupplier);

// uploadNota: field "nota" bersifat opsional, request tetap jalan tanpa file
router.post(
  "/purchases",
  adminOnly,
  uploadNota,
  purchaseController.createPurchase,
);
router.get(
  "/purchases/report",
  adminOnly,
  purchaseController.getPurchaseReport,
);
router.get(
  "/purchases/report/expired",
  adminOnly,
  purchaseController.getExpiredReport,
);
router.get(
  "/purchases/dashboard",
  adminOnly,
  purchaseController.getPurchaseDashboard,
);
router.get("/purchases", adminOnly, purchaseController.getAllPurchases);
router.get("/purchases/:id", adminOnly, purchaseController.getPurchaseById);
router.delete("/purchases/:id", adminOnly, purchaseController.deletePurchase);

module.exports = router;
