// routes/auth.routes.js
// Route publik (tanpa token) — login. Di-mount TERPISAH di server.js, sebelum
// middleware authenticate, karena untuk login pengguna belum punya token.
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

module.exports = router;
