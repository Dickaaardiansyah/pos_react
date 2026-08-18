// services/stockOpnameService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — aturan bisnis Stock Opname: validasi input, pembuatan kode
// sesi, dan pemetaan hasil ke bentuk yang dikembalikan controller. Perhitungan
// selisih & penyesuaian stok yang sesungguhnya hidup di model (dalam satu
// transaksi DB) supaya konsisten (semua-atau-tidak-sama-sekali).
// ─────────────────────────────────────────────────────────────────────────────
const stockOpnameModel = require("../models/stockOpnameModel");
const { ValidationError, NotFoundError } = require("./productService");
const { toLocalDatetime } = require("./transactionService");

function generateOpnameCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `SO${date}${rand}`;
}

const stockOpnameService = {
  listProducts(filters) {
    return stockOpnameModel.findProductsForOpname(filters);
  },

  // `user` = req.user (hasil verifikasi JWT). recordedBy SELALU diambil
  // dari sini, TIDAK PERNAH dari payload — supaya identitas pencatat
  // stock opname tidak bisa dipalsukan lewat body request.
  async createSession(payload, user) {
    const { opname_date, notes, items } = payload;
    if (!opname_date)
      throw new ValidationError("Tanggal stock opname wajib diisi");
    if (!items || items.length === 0)
      throw new ValidationError("Pilih minimal satu produk untuk diperiksa");

    for (const item of items) {
      if (
        item.physical_stock === undefined ||
        item.physical_stock === null ||
        item.physical_stock === ""
      ) {
        throw new ValidationError("Stok fisik wajib diisi untuk setiap produk");
      }
      if (Number(item.physical_stock) < 0)
        throw new ValidationError("Stok fisik tidak boleh negatif");
    }

    // Tolak product_id duplikat dalam satu sesi. Kalau lolos, tiap baris
    // duplikat akan dihitung selisihnya terhadap system_stock yang SAMA
    // (dibaca sekali, belum ter-update oleh baris duplikat sebelumnya),
    // jadi total_difference_qty/value & jurnal opname bisa salah — mis.
    // stok sistem 100, baris 1 fisik=90 (selisih -10), baris 2 fisik=80
    // (dihitung dari 100 lagi, bukan 90, jadi selisih -20) → total -30,
    // padahal perubahan stok sebenarnya cuma 100 → 80 = -20.
    const productIds = items.map((item) => Number(item.product_id));
    if (new Set(productIds).size !== productIds.length) {
      throw new ValidationError(
        "Ada produk yang muncul lebih dari sekali dalam sesi ini. Setiap produk hanya boleh diperiksa satu kali per sesi stock opname.",
      );
    }

    // Sesi opname + penyesuaian stok + posting jurnal selisih (jika ada)
    // semuanya terjadi dalam SATU DB transaction di
    // stockOpnameModel.createSession — kalau jurnal gagal, semuanya rollback.
    const session = await stockOpnameModel.createSession({
      opnameCode: generateOpnameCode(),
      opnameDate: opname_date,
      notes,
      recordedBy: user?.name || "Admin",
      items,
      occurredAt: toLocalDatetime(),
    });

    return session;
  },

  async list({ start_date, end_date, search, page = 1, limit = 20 }) {
    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const { total, rows } = await stockOpnameModel.findAll({
      startDate: start_date,
      endDate: end_date,
      search,
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit,
    });
    return { data: rows, total, page: parsedPage, limit: parsedLimit };
  },

  async getDetail(id) {
    const session = await stockOpnameModel.findById(id);
    if (!session) throw new NotFoundError("Sesi stock opname tidak ditemukan");
    const items = await stockOpnameModel.findItemsBySessionId(id);
    return { ...session, items };
  },
};

module.exports = stockOpnameService;
