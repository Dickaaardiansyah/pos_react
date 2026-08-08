// backend/services/notificationService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — notifikasi otomatis untuk 3 kondisi stok:
//   1. stock_out      — stok == 0 (kritis)
//   2. low_stock      — stok <= min_stock, stok > 0 (peringatan manual)
//   3. reorder_point   — stok <= Reorder Point hasil hitungan ROP (peringatan)
//
// low_stock & reorder_point SENGAJA dipisah, tidak digabung jadi satu kondisi
// (lihat catatan reviewer & productService.calculateReorderPoint) — supaya
// toko tetap bisa membaca dua sinyal restock yang beda makna. stock_out
// diprioritaskan di atas low_stock (kalau stok 0, hanya stock_out yang dibuat,
// low_stock tidak dobel-muncul untuk kondisi yang sama).
//
// Tidak ada cron/scheduler — checkAndGenerate() dipanggil "lazy" tiap kali
// endpoint notifikasi diakses (lihat notificationController). Cukup murah
// untuk skala satu toko dan tidak perlu proses background tambahan.
// ─────────────────────────────────────────────────────────────────────────────
const notificationModel = require("../models/notificationModel");
const productModel = require("../models/productModel");
const { productService } = require("./productService");
const { webPushService } = require("./webPushService");

async function upsertNotification({ type, level, product, message }) {
  const active = await notificationModel.findActiveByProductAndType(
    product.id,
    type,
  );
  // Kondisi masih sama seperti sebelumnya (masih ada notifikasi aktif untuk
  // produk+jenis ini) — jangan buat duplikat, biarkan yang lama tetap jadi
  // satu-satunya notifikasi aktif untuk kejadian ini.
  if (active) return;

  await notificationModel.create({
    type,
    level,
    productId: product.id,
    productName: product.name,
    message,
  });

  // Push ke browser HANYA saat notifikasi benar-benar baru dibuat (bukan
  // tiap kali checkAndGenerate berjalan) — supaya tidak spam notifikasi
  // untuk kondisi yang sama berkali-kali. Fire-and-forget: kegagalan kirim
  // push tidak boleh menggagalkan pembuatan notifikasi di atas.
  webPushService
    .notifyNewNotification({ type, level, message })
    .catch((err) => console.error("webPushService gagal:", err.message));
}

// Kondisi type tsb untuk produk ini sudah TIDAK terjadi lagi (mis. sudah
// direstock) — selesaikan notifikasi aktif yang ada (kalau ada), supaya
// riwayat tercatat tapi tidak lagi dihitung "aktif"/butuh perhatian.
async function resolveIfActive(productId, type) {
  const active = await notificationModel.findActiveByProductAndType(
    productId,
    type,
  );
  if (active) await notificationModel.resolve(active.id);
}

const notificationService = {
  async checkAndGenerate() {
    const [products, reorderPoints] = await Promise.all([
      productModel.findAll({}),
      productService.listReorderPoints({ days: 30 }),
    ]);

    const reorderByProductId = new Map(reorderPoints.map((r) => [r.id, r]));

    await Promise.all(
      products.map(async (p) => {
        const stock = Number(p.stock) || 0;
        const minStock = Number(p.min_stock) || 0;

        // ── stock_out & low_stock (saling eksklusif untuk produk yang sama) ──
        if (stock <= 0) {
          await upsertNotification({
            type: "stock_out",
            level: "critical",
            product: p,
            message: `${p.name} stoknya habis (0 ${p.unit || ""})`.trim(),
          });
          // stok 0 otomatis <= min_stock juga — jangan dobel-munculkan
          // low_stock untuk kejadian yang sama persis.
          await resolveIfActive(p.id, "low_stock");
        } else {
          await resolveIfActive(p.id, "stock_out");
          if (stock <= minStock) {
            await upsertNotification({
              type: "low_stock",
              level: "warning",
              product: p,
              message:
                `${p.name} stok menipis (tersisa ${stock} ${p.unit || ""}, minimum ${minStock})`.trim(),
            });
          } else {
            await resolveIfActive(p.id, "low_stock");
          }
        }

        // ── reorder_point — independen, hanya untuk produk yang sudah diatur
        //    Lead Time-nya (lihat productService.listReorderPoints) ──────────
        const rop = reorderByProductId.get(p.id);
        if (rop && rop.needs_reorder) {
          await upsertNotification({
            type: "reorder_point",
            level: "warning",
            product: p,
            message: `${p.name} sudah mencapai Reorder Point (stok ${rop.stock} ${p.unit || ""}, ROP ${rop.reorder_point} ${p.unit || ""})`,
          });
        } else {
          await resolveIfActive(p.id, "reorder_point");
        }
      }),
    );
  },

  async list({ only_unread, limit, page }) {
    await notificationService.checkAndGenerate();
    const parsedLimit = Number(limit) > 0 ? Number(limit) : 50;
    const parsedPage = Number(page) > 0 ? Number(page) : 1;
    const offset = (parsedPage - 1) * parsedLimit;
    const items = await notificationModel.findAll({
      onlyUnread: only_unread === "true" || only_unread === true,
      limit: parsedLimit,
      offset,
    });
    return { items, page: parsedPage, limit: parsedLimit };
  },

  async unreadCount() {
    await notificationService.checkAndGenerate();
    const { total } = await notificationModel.countUnread();
    return Number(total) || 0;
  },

  markRead(id) {
    return notificationModel.markRead(id);
  },

  markAllRead() {
    return notificationModel.markAllRead();
  },
};

module.exports = { notificationService };
