// services/voidRequestService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — alur pengajuan & persetujuan void transaksi.
//
// Latar belakang (review dosen): sebelumnya endpoint void mengizinkan role
// 'cashier' membatalkan transaksi SIAPA PUN, KAPAN PUN, tanpa persetujuan —
// hanya perlu mengisi alasan. Tidak ada pemeriksaan pembuat transaksi,
// kepemilikan shift, rentang waktu transaksi, status aktif akun kasir,
// ataupun persetujuan supervisor.
//
// Alur baru:
//   • Kasir TIDAK LAGI bisa membatalkan langsung. Kasir hanya mengajukan
//     permintaan (void_requests, status 'pending') — lolos lima pemeriksaan
//     di create() di bawah.
//   • Admin (satu-satunya role "supervisor" yang ada di sistem ini — lihat
//     ENUM users.role) me-review: approve() benar-benar mengeksekusi void
//     (memanggil transactionService.voidTransaction yang sudah ada — locking,
//     pengembalian stok, dan pembalikan jurnal TIDAK diubah), atau reject()
//     menolak dengan catatan wajib.
//   • Admin tetap bisa membatalkan transaksi LANGSUNG tanpa pengajuan lewat
//     endpoint void yang sudah ada (dia sendiri otoritas persetujuannya) —
//     lihat routes/transaction.routes.js, sekarang authorize("admin") saja.
// ─────────────────────────────────────────────────────────────────────────────
const voidRequestModel = require("../models/voidRequestModel");
const transactionModel = require("../models/transactionModel");
const cashRegisterModel = require("../models/cashRegisterModel");
const settingModel = require("../models/settingModel");
const { ValidationError, NotFoundError } = require("./productService");
const { ForbiddenError } = require("../middleware/auth");

// Batas waktu kasir boleh MENGAJUKAN void sendiri, dihitung dari
// transactions.created_at. Di luar rentang ini transaksi dianggap sudah
// "settled" (kemungkinan sudah tercermin di laporan/rekonsiliasi berjalan)
// dan hanya admin yang boleh menanganinya.
const CASHIER_VOID_WINDOW_HOURS = 24;

// created_at dikirim sebagai string mentah "YYYY-MM-DD HH:MM:SS" (lihat
// config/database.js — dateStrings: true), representasi waktu lokal WIB,
// bukan UTC. Diparse sebagai waktu lokal juga (bukan new Date(str) yang
// akan salah menganggapnya UTC di beberapa runtime).
function hoursSince(dateTimeStr) {
  const then = new Date(dateTimeStr.replace(" ", "T"));
  return (Date.now() - then.getTime()) / 3600000;
}

async function assertActiveUser(userId, actionLabel) {
  const fresh = await settingModel.findPublicUserById(userId);
  if (!fresh || !fresh.is_active) {
    throw new ForbiddenError(
      `Akun Anda tidak aktif. Hubungi admin untuk ${actionLabel}.`,
    );
  }
  return fresh;
}

const voidRequestService = {
  // Kasir mengajukan pembatalan. Semua lima poin revisi dosen dicek di sini,
  // secara berurutan, sebelum baris void_requests dibuat.
  async create(transactionId, { reason }, requestUser) {
    if (!reason || !reason.trim())
      throw new ValidationError("Alasan pembatalan wajib diisi");

    if (requestUser.role === "admin") {
      throw new ValidationError(
        "Admin bisa langsung membatalkan transaksi lewat menu Void — tidak perlu pengajuan persetujuan",
      );
    }

    // (4) Kasir yang sedang aktif — verifikasi ulang ke database, jangan
    // hanya percaya isi token JWT (yang bisa saja masih berlaku walau akun
    // baru saja dinonaktifkan admin di tempat lain).
    await assertActiveUser(requestUser.id, "mengajukan pembatalan");

    const tx = await transactionModel.findById(transactionId);
    if (!tx) throw new NotFoundError("Transaksi tidak ditemukan");
    if (tx.status !== "completed") {
      throw new ValidationError(
        tx.status === "cancelled"
          ? "Transaksi ini sudah dibatalkan sebelumnya"
          : `Transaksi berstatus '${tx.status}' tidak dapat dibatalkan`,
      );
    }

    // (1) Transaksi dibuat oleh siapa — kasir hanya boleh mengajukan void
    // untuk transaksinya sendiri. Transaksi lama (sebelum kolom cashier_id
    // ada / dibuat sebelum migration ownership) tidak bisa diverifikasi
    // kepemilikannya sama sekali — didorong ke admin saja.
    if (!tx.cashier_id) {
      throw new ForbiddenError(
        "Transaksi ini tidak memiliki data kasir pemilik (data lama sebelum fitur ini aktif). Hanya admin yang bisa membatalkannya secara langsung.",
      );
    }
    if (tx.cashier_id !== requestUser.id) {
      throw new ForbiddenError(
        "Anda hanya bisa mengajukan pembatalan untuk transaksi yang Anda buat sendiri.",
      );
    }

    // (2) Shift milik siapa — kalau transaksi tertaut ke sebuah sesi kas,
    // sesi itu harus masih milik kasir yang sama dan belum ditutup. Sesi
    // yang sudah ditutup berarti sudah direkonsiliasi (Tutup Kas); mengubah
    // stok/jurnal setelah itu berisiko membuat laporan kas tidak sinkron.
    if (tx.shift_id) {
      const shift = await cashRegisterModel.findShiftById(tx.shift_id);
      if (shift) {
        if (
          shift.opened_by_user_id != null &&
          shift.opened_by_user_id !== requestUser.id
        ) {
          throw new ForbiddenError(
            "Transaksi ini tercatat pada sesi kas milik kasir lain. Hanya admin yang bisa membatalkannya.",
          );
        }
        if (shift.status === "closed") {
          throw new ForbiddenError(
            "Sesi kas untuk transaksi ini sudah ditutup (Tutup Kas). Hanya admin yang bisa membatalkannya.",
          );
        }
      }
    }

    // (3) Tanggal transaksi — di luar jendela waktu wajar, hanya admin yang
    // boleh menangani.
    if (hoursSince(tx.created_at) > CASHIER_VOID_WINDOW_HOURS) {
      throw new ForbiddenError(
        `Transaksi ini dibuat lebih dari ${CASHIER_VOID_WINDOW_HOURS} jam lalu. Hanya admin yang bisa membatalkannya.`,
      );
    }

    // Cegah pengajuan ganda untuk transaksi yang sama.
    const existing =
      await voidRequestModel.findPendingByTransaction(transactionId);
    if (existing) {
      throw new ValidationError(
        "Transaksi ini sudah memiliki pengajuan void yang masih menunggu persetujuan.",
      );
    }

    const created = await voidRequestModel.create({
      transactionId,
      requestedByUserId: requestUser.id,
      requestedByName: requestUser.name,
      reason: reason.trim(),
    });
    return voidRequestModel.findById(created.insertId);
  },

  // (5) Persetujuan supervisor — hanya admin yang mencapai titik ini
  // (dijamin oleh authorize("admin") di route). approve() benar-benar
  // mengeksekusi pembatalan lewat transactionModel.voidTransaction yang
  // sudah ada (locking FOR UPDATE, pengembalian stok, pembalikan jurnal
  // tidak diubah sama sekali).
  async approve(requestId, { note }, adminUser) {
    await assertActiveUser(adminUser.id, "menyetujui pengajuan void");

    // Klaim baris secara atomik (UPDATE ... WHERE status='pending') supaya
    // dua admin yang memproses pengajuan yang sama nyaris bersamaan tidak
    // saling menimpa.
    const claim = await voidRequestModel.claimApproved(requestId, {
      reviewedByUserId: adminUser.id,
      reviewedByName: adminUser.name,
      note: note?.trim() || null,
    });
    if (claim.affectedRows === 0) {
      const existing = await voidRequestModel.findById(requestId);
      if (!existing) throw new NotFoundError("Pengajuan void tidak ditemukan");
      throw new ValidationError(
        `Pengajuan ini sudah diproses sebelumnya (status: ${existing.status})`,
      );
    }

    const request = await voidRequestModel.findById(requestId);
    try {
      const voidResult = await transactionModel.voidTransaction(
        request.transaction_id,
        {
          reason: request.reason,
          voidedBy: `${adminUser.name} (menyetujui pengajuan dari ${request.requested_by_name})`,
        },
      );
      return { request, void: voidResult };
    } catch (e) {
      // Eksekusi void gagal SETELAH diklaim (mis. transaksi ternyata sudah
      // dibatalkan lewat jalur lain) — kembalikan status ke 'pending' supaya
      // tidak macet mengaku 'approved' padahal transaksinya belum benar-benar
      // dibatalkan, dan admin bisa melihat lagi / mencoba ulang.
      await voidRequestModel.resetToPending(requestId);
      e.status = /tidak|sudah|wajib/i.test(e.message) ? 400 : e.status || 500;
      throw e;
    }
  },

  async reject(requestId, { note }, adminUser) {
    if (!note || !note.trim())
      throw new ValidationError("Catatan penolakan wajib diisi");
    await assertActiveUser(adminUser.id, "menolak pengajuan void");

    const claim = await voidRequestModel.claimRejected(requestId, {
      reviewedByUserId: adminUser.id,
      reviewedByName: adminUser.name,
      note: note.trim(),
    });
    if (claim.affectedRows === 0) {
      const existing = await voidRequestModel.findById(requestId);
      if (!existing) throw new NotFoundError("Pengajuan void tidak ditemukan");
      throw new ValidationError(
        `Pengajuan ini sudah diproses sebelumnya (status: ${existing.status})`,
      );
    }
    return voidRequestModel.findById(requestId);
  },

  // Admin melihat semua pengajuan (bisa difilter status); kasir hanya
  // melihat pengajuannya sendiri.
  async list({ status }, user) {
    if (user.role === "admin") {
      return voidRequestModel.listAll({ status });
    }
    return voidRequestModel.listByRequester(user.id, { status });
  },
};

module.exports = { voidRequestService, CASHIER_VOID_WINDOW_HOURS };
