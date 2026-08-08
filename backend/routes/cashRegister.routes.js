// routes/cashRegister.routes.js
// Modul Kas Kecil (Cash Register): buka/tutup kas & pencatatan cash in/out.
const express = require("express");
const router = express.Router();
const cashRegisterController = require("../controllers/cashRegisterController");
const { authorize } = require("../middleware/auth");

// Buka/tutup kas & cash in/out khusus kasir — admin sengaja TIDAK diizinkan
// akses "Kas Berjalan" sama sekali (kas kecil adalah tanggung jawab kasir
// yang sedang bertugas; admin hanya melihat tab Riwayat Tutup Kas & rekap,
// tidak ikut pegang atau mengubah shift kas harian).
router.get(
  "/cash-register/cash-out-categories",
  cashRegisterController.getCashOutCategories,
);
router.get(
  "/cash-register/cash-in-categories",
  cashRegisterController.getCashInCategories,
);

router.get("/cash-register/active", cashRegisterController.getActiveShift);
router.post(
  "/cash-register/open",
  authorize("cashier"),
  cashRegisterController.openShift,
);
router.post(
  "/cash-register/:id/close",
  authorize("cashier"),
  cashRegisterController.closeShift,
);

// Cash in/out (fitur "Biaya") — khusus kasir yang sedang memegang shift.
// Admin TIDAK diizinkan akses "Kas Berjalan" sama sekali (hanya boleh
// melihat Riwayat Tutup Kas), jadi endpoint ini juga dibatasi ke role
// kasir, bukan cuma disembunyikan di UI.
router.post(
  "/cash-register/movements",
  authorize("cashier"),
  cashRegisterController.createMovement,
);
router.delete(
  "/cash-register/movements/:id",
  authorize("cashier"),
  cashRegisterController.deleteMovement,
);

// Riwayat semua sesi kas (lintas kasir) & detail sesi tertentu — khusus admin.
router.get(
  "/cash-register/history",
  authorize("admin"),
  cashRegisterController.getHistory,
);
router.get(
  "/cash-register/:id",
  authorize("admin"),
  cashRegisterController.getShiftDetail,
);

module.exports = router;
