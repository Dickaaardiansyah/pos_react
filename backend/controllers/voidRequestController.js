// controllers/voidRequestController.js
const { asyncHandler } = require("./_helpers");
const { voidRequestService } = require("../services/voidRequestService");

// Kasir mengajukan pembatalan (butuh persetujuan admin). Admin yang
// memanggil ini akan ditolak service dan diarahkan ke endpoint void langsung.
exports.createRequest = asyncHandler(async (req, res) => {
  const result = await voidRequestService.create(
    req.params.id,
    { reason: req.body.reason },
    req.user,
  );
  res.status(201).json({
    success: true,
    data: result,
    message: "Pengajuan pembatalan terkirim, menunggu persetujuan admin",
  });
});

// Admin melihat semua pengajuan; kasir hanya melihat pengajuannya sendiri.
exports.listRequests = asyncHandler(async (req, res) => {
  const result = await voidRequestService.list(
    { status: req.query.status },
    req.user,
  );
  res.json({ success: true, data: result });
});

// Admin-only (lihat routes) — menyetujui & langsung mengeksekusi void.
exports.approveRequest = asyncHandler(async (req, res) => {
  const result = await voidRequestService.approve(
    req.params.id,
    { note: req.body.note },
    req.user,
  );
  res.json({
    success: true,
    data: result,
    message: "Pengajuan disetujui, transaksi berhasil dibatalkan",
  });
});

// Admin-only — menolak dengan catatan wajib.
exports.rejectRequest = asyncHandler(async (req, res) => {
  const result = await voidRequestService.reject(
    req.params.id,
    { note: req.body.note },
    req.user,
  );
  res.json({
    success: true,
    data: result,
    message: "Pengajuan void ditolak",
  });
});
