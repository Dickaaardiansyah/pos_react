// middleware/uploadNota.js
// ─────────────────────────────────────────────────────────────────────────────
// Upload file nota/bukti pembelian dari supplier. Bersifat OPSIONAL — endpoint
// tetap jalan normal kalau tidak ada file dikirim. Mendukung foto (jpg/png/webp)
// dan PDF hasil scan, maksimal 5MB.
//
// FIX KEAMANAN (review dosen): sebelumnya validasi HANYA mengandalkan
// `file.mimetype` (nilai header Content-Type bagian multipart yang dikirim
// klien — bisa ditulis bebas, tidak mencerminkan isi file sebenarnya) untuk
// menentukan format diterima/ditolak, sementara EKSTENSI file yang disimpan
// dipertahankan apa adanya dari `file.originalname` (juga sepenuhnya
// dikontrol klien). Akibatnya penyerang bisa mengunggah file apa pun
// (mis. .html berisi script, atau file executable) selama header
// Content-Type di-set seolah-olah "image/jpeg", dan file tsb tersimpan
// dengan ekstensi bebas pilihan penyerang.
//
// Sekarang: file diterima dulu dengan nama sementara TANPA ekstensi dari
// klien, lalu SETELAH selesai ditulis ke disk, beberapa byte pertamanya
// dibaca dan dicocokkan dengan "magic number" (signature biner) format
// JPG/PNG/WEBP/PDF yang sesungguhnya. Ekstensi FINAL file yang disimpan
// ditentukan dari hasil deteksi ini, bukan dari originalname — dan file
// yang isinya tidak cocok dengan signature manapun langsung dihapus &
// ditolak, walau header Content-Type/mimetype-nya mengaku valid.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "nota");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Signature biner tiap format yang diizinkan. Dicocokkan terhadap byte
// PERTAMA file sungguhan, bukan metadata yang dikirim klien.
const SIGNATURES = [
  {
    ext: ".jpg",
    mime: "image/jpeg",
    check: (b) =>
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: ".png",
    mime: "image/png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    ext: ".webp",
    mime: "image/webp",
    check: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    ext: ".pdf",
    mime: "application/pdf",
    check: (b) => b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-",
  },
];

function detectSignature(buffer) {
  return SIGNATURES.find((sig) => sig.check(buffer)) || null;
}

// Nama file sementara acak, sengaja TANPA ekstensi dari client — ekstensi
// asli ditentukan belakangan lewat pengecekan magic number di bawah.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const tempName = `nota_${Date.now()}_${Math.floor(Math.random() * 1e6)}.tmp`;
    cb(null, tempName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
}).single("nota");

// Field opsional bernama "nota" — kalau tidak dikirim, req.file akan
// undefined dan request tetap lanjut normal (bukan error).
function uploadNota(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          Object.assign(new Error("Ukuran file nota maksimal 5MB"), {
            status: 400,
          }),
        );
      }
      return next(err);
    }
    if (!req.file) return next(); // tidak ada file diunggah, lanjut normal

    const tempPath = req.file.path;

    fs.open(tempPath, "r", (openErr, fd) => {
      if (openErr) return next(openErr);

      const header = Buffer.alloc(16);
      fs.read(fd, header, 0, 16, 0, (readErr, bytesRead) => {
        fs.close(fd, () => {});
        if (readErr) return next(readErr);

        const signature = detectSignature(header.subarray(0, bytesRead));
        if (!signature) {
          // Isi file bukan JPG/PNG/WEBP/PDF sungguhan (walau klien mengaku
          // lewat Content-Type) — hapus file yang sudah terlanjur ditulis
          // & tolak requestnya.
          fs.unlink(tempPath, () => {});
          return next(
            Object.assign(
              new Error("Format file nota harus JPG, PNG, WEBP, atau PDF"),
              { status: 400 },
            ),
          );
        }

        const finalPath = tempPath.replace(/\.tmp$/, signature.ext);
        fs.rename(tempPath, finalPath, (renameErr) => {
          if (renameErr) return next(renameErr);
          // originalname dari client TETAP disimpan sebagai metadata
          // tampilan saja (nota_original_name, ditampilkan ke user) —
          // TIDAK dipakai lagi untuk menentukan ekstensi file di disk.
          req.file.filename = path.basename(finalPath);
          req.file.path = finalPath;
          req.file.mimetype = signature.mime;
          next();
        });
      });
    });
  });
}

module.exports = uploadNota;
