// services/otherPayableService.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVICE LAYER — validasi & orkestrasi modul Hutang Non-Supplier (Pinjaman
// Bank & Utang Lainnya). Mirror pola payableService.js.
// ─────────────────────────────────────────────────────────────────────────────
const otherPayableModel = require("../models/otherPayableModel");
const { ValidationError, NotFoundError } = require("./productService");

function generateCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `PJM${date}${rand}`;
}

const otherPayableService = {
  async create(payload) {
    const {
      type,
      creditor_name,
      principal_amount,
      interest_rate,
      disbursement_date,
      due_date,
      target_account,
      notes,
      recorded_by,
    } = payload;

    if (!["pinjaman_bank", "utang_lainnya"].includes(type)) {
      throw new ValidationError("Jenis hutang tidak valid");
    }
    if (!creditor_name || !creditor_name.trim()) {
      throw new ValidationError(
        type === "pinjaman_bank"
          ? "Nama bank/kreditur wajib diisi"
          : "Nama pemberi utang wajib diisi",
      );
    }
    const principal = parseFloat(principal_amount);
    if (!principal || principal <= 0) {
      throw new ValidationError("Jumlah pokok harus lebih dari 0");
    }
    if (!disbursement_date) {
      throw new ValidationError("Tanggal pencairan wajib diisi");
    }
    if (!due_date) {
      throw new ValidationError("Tanggal jatuh tempo wajib diisi");
    }
    const targetAccount = target_account || "bank";
    if (!["kas", "bank"].includes(targetAccount)) {
      throw new ValidationError("Akun tujuan tidak valid");
    }

    const result = await otherPayableModel.create({
      code: generateCode(),
      type,
      creditorName: creditor_name.trim(),
      principalAmount: principal,
      interestRate: interest_rate ? parseFloat(interest_rate) : null,
      disbursementDate: disbursement_date,
      dueDate: due_date,
      targetAccount,
      notes,
      recordedBy: recorded_by,
    });
    return otherPayableModel.findById(result.insertId);
  },

  async list(filters) {
    return otherPayableModel.findAll(filters);
  },

  async getById(id) {
    const op = await otherPayableModel.findById(id);
    if (!op) throw new NotFoundError("Pinjaman/utang tidak ditemukan");
    const payments = await otherPayableModel.findPayments(id);
    return { ...op, payments };
  },

  async remove(id) {
    const op = await otherPayableModel.findById(id);
    if (!op) throw new NotFoundError("Pinjaman/utang tidak ditemukan");
    if (Number(op.outstanding_amount) < Number(op.principal_amount)) {
      throw new ValidationError(
        "Tidak bisa menghapus pinjaman yang sudah pernah dicicil — riwayat jurnal akan tidak konsisten",
      );
    }
    return otherPayableModel.remove(id);
  },

  async recordPayment(id, payload) {
    const {
      principal_amount,
      interest_amount,
      payment_date,
      payment_method,
      notes,
      recorded_by,
    } = payload;
    const principal = parseFloat(principal_amount) || 0;
    const interest = parseFloat(interest_amount) || 0;
    if (principal + interest <= 0) {
      throw new ValidationError("Jumlah pembayaran harus lebih dari 0");
    }
    if (!payment_date) {
      throw new ValidationError("Tanggal pembayaran wajib diisi");
    }
    return otherPayableModel.addPayment(id, {
      principalAmount: principal,
      interestAmount: interest,
      paymentDate: payment_date,
      paymentMethod: payment_method,
      notes,
      recordedBy: recorded_by,
    });
  },

  async summary() {
    return otherPayableModel.summary();
  },
};

module.exports = otherPayableService;
