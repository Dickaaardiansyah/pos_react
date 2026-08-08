// controllers/productController.js
// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER LAYER — menerjemahkan request HTTP ke pemanggilan service, lalu
// memformat hasilnya sebagai JSON. Tidak ada query SQL atau aturan bisnis di sini.
// ─────────────────────────────────────────────────────────────────────────────
const { asyncHandler } = require("./_helpers");
const { productService } = require("../services/productService");
const { unitService } = require("../services/unitService");

exports.getAllProducts = asyncHandler(async (req, res) => {
  const products = await productService.listProducts(req.query);
  res.json({ success: true, data: products, total: products.length });
});

exports.getReorderPoints = asyncHandler(async (req, res) => {
  const data = await productService.listReorderPoints({
    days: req.query.days,
  });
  res.json({ success: true, data, total: data.length });
});

exports.getProductByBarcode = asyncHandler(async (req, res) => {
  const product = await productService.getByBarcode(req.params.barcode);
  res.json({ success: true, data: product });
});

exports.getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getById(req.params.id);
  res.json({ success: true, data: product });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json({
    success: true,
    data: product,
    message: "Produk berhasil ditambahkan",
  });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.json({
    success: true,
    data: product,
    message: "Produk berhasil diperbarui",
  });
});

exports.updateStock = asyncHandler(async (req, res) => {
  const product = await productService.updateStock(req.params.id, req.body);
  res.json({
    success: true,
    data: product,
    message: "Stok berhasil diperbarui",
  });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  res.json({ success: true, message: "Produk berhasil dihapus" });
});

exports.getStockHistory = asyncHandler(async (req, res) => {
  const history = await productService.getStockHistory(req.params.id);
  res.json({ success: true, data: history });
});

exports.getAllCategories = asyncHandler(async (req, res) => {
  const categories = await productService.listCategories();
  res.json({ success: true, data: categories });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const category = await productService.createCategory(req.body);
  res.status(201).json({ success: true, data: category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const result = await productService.deleteCategory(req.params.id);
  res.json({
    success: true,
    message:
      result.affectedProducts > 0
        ? `Kategori dihapus. ${result.affectedProducts} produk jadi tanpa kategori.`
        : "Kategori dihapus",
  });
});

exports.getAllUnits = asyncHandler(async (req, res) => {
  const units = await unitService.listUnits();
  res.json({ success: true, data: units });
});

exports.createUnit = asyncHandler(async (req, res) => {
  const unit = await unitService.createUnit(req.body);
  res.status(201).json({ success: true, data: unit });
});

exports.deleteUnit = asyncHandler(async (req, res) => {
  await unitService.deleteUnit(req.params.id);
  res.json({ success: true, message: "Satuan dihapus" });
});
