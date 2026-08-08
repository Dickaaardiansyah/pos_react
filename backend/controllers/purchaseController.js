// controllers/purchaseController.js
const { asyncHandler } = require("./_helpers");
const purchaseService = require("../services/purchaseService");

exports.getAllSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await purchaseService.listSuppliers();
  res.json({ success: true, data: suppliers });
});

exports.createSupplier = asyncHandler(async (req, res) => {
  const supplier = await purchaseService.createSupplier(req.body);
  res.status(201).json({
    success: true,
    data: supplier,
    message: "Supplier berhasil ditambahkan",
  });
});

exports.updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await purchaseService.updateSupplier(
    req.params.id,
    req.body,
  );
  res.json({ success: true, data: supplier, message: "Supplier diperbarui" });
});

exports.deleteSupplier = asyncHandler(async (req, res) => {
  await purchaseService.deleteSupplier(req.params.id);
  res.json({ success: true, message: "Supplier dinonaktifkan" });
});

exports.createPurchase = asyncHandler(async (req, res) => {
  // Request datang sebagai multipart/form-data (karena bisa membawa file nota),
  // jadi field "items" dikirim frontend sebagai string JSON dan perlu di-parse.
  const body = { ...req.body };
  if (typeof body.items === "string") {
    try {
      body.items = JSON.parse(body.items);
    } catch {
      body.items = [];
    }
  }

  // req.file diisi multer kalau user mengunggah nota. Bersifat opsional.
  if (req.file) {
    body.nota_url = `/uploads/nota/${req.file.filename}`;
    body.nota_original_name = req.file.originalname;
  }

  const purchase = await purchaseService.recordPurchase(body);
  res.status(201).json({
    success: true,
    data: purchase,
    message: "Pembelian berhasil dicatat, stok produk diperbarui",
  });
});

exports.getAllPurchases = asyncHandler(async (req, res) => {
  const result = await purchaseService.list(req.query);
  res.json({ success: true, ...result });
});

exports.getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getDetail(req.params.id);
  res.json({ success: true, data: purchase });
});

exports.getPurchaseReport = asyncHandler(async (req, res) => {
  const report = await purchaseService.report(req.query);
  res.json({ success: true, data: report });
});

exports.getExpiredReport = asyncHandler(async (req, res) => {
  const report = await purchaseService.expiredReport(req.query);
  res.json({ success: true, data: report });
});

exports.getPurchaseDashboard = asyncHandler(async (req, res) => {
  const dashboard = await purchaseService.dashboard();
  res.json({ success: true, data: dashboard });
});

exports.deletePurchase = asyncHandler(async (req, res) => {
  await purchaseService.deletePurchase(req.params.id);
  res.json({ success: true, message: "Pembelian dihapus" });
});
