// controllers/purchaseController.js
const fs = require("fs");
const path = require("path");
const { asyncHandler } = require("./_helpers");
const purchaseService = require("../services/purchaseService");

const NOTA_DIR = path.join(__dirname, "..", "uploads", "nota");

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
    // Diarahkan ke route API terautentikasi (bukan langsung ke
    // /uploads/... yang statis & publik — lihat catatan di server.js
    // dan getNota di bawah).
    body.nota_url = `/api/purchases/nota/${req.file.filename}`;
    body.nota_original_name = req.file.originalname;
  }

  const purchase = await purchaseService.recordPurchase(body, req.user);
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

// Menyajikan file nota supplier. Route ini dipasang di bawah
// app.use("/api", authenticate, ...) DAN diberi middleware `adminOnly`
// (lihat routes/purchase.routes.js) — jadi request harus lolos verifikasi
// JWT dulu sebelum sampai sini, tidak seperti express.static publik yang
// dipakai sebelumnya.
exports.getNota = asyncHandler(async (req, res) => {
  // path.basename membuang seluruh komponen folder dari input user (mis.
  // "../../.env" akan menjadi ".env" lalu tetap dicari di dalam NOTA_DIR,
  // bukan keluar dari folder itu) — mencegah path traversal lewat
  // parameter filename.
  const filename = path.basename(req.params.filename || "");
  const filePath = path.join(NOTA_DIR, filename);

  // Jaga-jaga tambahan: pastikan hasil resolve tetap di dalam NOTA_DIR.
  if (!filename || !filePath.startsWith(NOTA_DIR + path.sep)) {
    return res
      .status(404)
      .json({ success: false, message: "File nota tidak ditemukan" });
  }

  if (!fs.existsSync(filePath)) {
    return res
      .status(404)
      .json({ success: false, message: "File nota tidak ditemukan" });
  }

  res.sendFile(filePath);
});
