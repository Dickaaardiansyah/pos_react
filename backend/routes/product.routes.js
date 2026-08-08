// routes/product.routes.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { authorize } = require("../middleware/auth");

// Kasir butuh baca produk untuk transaksi kasir, jadi GET dibuka untuk semua
// role yang sudah login. Perubahan data produk (tambah/edit/hapus/stok)
// khusus admin.
router.get("/products", productController.getAllProducts);
router.get("/products/barcode/:barcode", productController.getProductByBarcode);
// Harus didaftarkan SEBELUM "/products/:id" — kalau tidak, ":id" akan
// menangkap "reorder-point" sebagai id produk.
router.get(
  "/products/reorder-point",
  authorize("admin"),
  productController.getReorderPoints,
);
router.get("/products/:id", productController.getProductById);
router.post("/products", authorize("admin"), productController.createProduct);
router.put(
  "/products/:id",
  authorize("admin"),
  productController.updateProduct,
);
router.delete(
  "/products/:id",
  authorize("admin"),
  productController.deleteProduct,
);
router.put(
  "/products/:id/stock",
  authorize("admin"),
  productController.updateStock,
);
router.get(
  "/products/:id/stock-history",
  authorize("admin"),
  productController.getStockHistory,
);

router.get("/categories", productController.getAllCategories);
router.post(
  "/categories",
  authorize("admin"),
  productController.createCategory,
);
router.delete(
  "/categories/:id",
  authorize("admin"),
  productController.deleteCategory,
);

// Satuan (units) — GET dibuka untuk semua role login (kasir butuh baca satuan
// produk), POST/DELETE khusus admin karena hanya dipakai dari form Produk.
router.get("/units", productController.getAllUnits);
router.post("/units", authorize("admin"), productController.createUnit);
router.delete("/units/:id", authorize("admin"), productController.deleteUnit);

module.exports = router;
