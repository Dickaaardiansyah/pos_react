// middleware/uploadNota.js
// ─────────────────────────────────────────────────────────────────────────────
// Upload file nota/bukti pembelian dari supplier. Bersifat OPSIONAL — endpoint
// tetap jalan normal kalau tidak ada file dikirim. Mendukung foto (jpg/png/webp)
// dan PDF hasil scan, maksimal 5MB.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "nota");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `nota_${Date.now()}_${Math.floor(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error("Format file nota harus JPG, PNG, WEBP, atau PDF"));
  }
  cb(null, true);
}

const uploadNota = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

// Field opsional bernama "nota" — kalau tidak dikirim, req.file akan undefined
// dan request tetap lanjut normal (bukan error).
module.exports = uploadNota.single("nota");
