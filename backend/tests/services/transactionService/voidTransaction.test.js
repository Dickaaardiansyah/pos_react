// tests/services/transactionService/voidTransaction.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.voidTransaction (SATU FUNGSI SAJA)
// Validasi alasan, admin aktif, status completed; kembalikan stok + status cancelled.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const {
  transactionService,
} = require("../../../services/transactionService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const {
  seedCheckoutReady,
  getProductStock,
  getTransaction,
} = require("./helpers");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

const kasir = { id: 2, name: "Kasir Test" };
const admin = { id: 1, name: "Admin Test" };

async function doCheckout(productOverrides = {}) {
  const { productId } = await seedCheckoutReady({
    userId: kasir.id,
    product: {
      barcode: `VD-${Date.now()}`,
      name: "Untuk Void",
      price: 8000,
      costPrice: 4000,
      stock: 20,
      ...productOverrides,
    },
  });
  const sale = await transactionService.checkout(
    {
      items: [{ product_id: productId, quantity: 3 }],
      payment_method: "cash",
      payment_amount: 50000,
    },
    kasir,
  );
  return { sale, productId };
}

describe("transactionService.voidTransaction", () => {
  test("menolak jika alasan pembatalan kosong", async () => {
    await expect(
      transactionService.voidTransaction(1, {
        reason: "  ",
        voided_by: "Admin",
      }),
    ).rejects.toThrow("Alasan pembatalan wajib diisi");
  });

  test("menolak jika akun admin yang membatalkan sudah nonaktif", async () => {
    const { getPool } = require("../../../config/database");
    const pool = getPool();
    // nonaktifkan admin seed
    await pool.query("UPDATE users SET is_active = 0 WHERE id = 1");

    await expect(
      transactionService.voidTransaction(1, {
        reason: "Salah input",
        voided_by: "Admin",
        adminUserId: 1,
      }),
    ).rejects.toThrow("Akun Anda tidak aktif");
  });

  test("melempar NotFoundError jika transaksi tidak ditemukan", async () => {
    await expect(
      transactionService.voidTransaction(999999, {
        reason: "Salah input",
        voided_by: "Admin",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  test("berhasil void transaksi completed: status cancelled, stok dikembalikan", async () => {
    const { sale, productId } = await doCheckout();
    expect(await getProductStock(productId)).toBe(17); // 20 - 3

    const result = await transactionService.voidTransaction(sale.id, {
      reason: "  Salah input harga  ",
      voided_by: admin.name,
      adminUserId: admin.id,
    });

    expect(result.status).toBe("cancelled");

    const tx = await getTransaction(sale.id);
    expect(tx.status).toBe("cancelled");
    expect(tx.void_reason).toBe("Salah input harga");
    expect(tx.voided_by).toBe("Admin Test");
    expect(tx.voided_at).not.toBeNull();

    // stok kembali
    expect(await getProductStock(productId)).toBe(20);
  });

  test("menolak void transaksi yang sudah cancelled", async () => {
    const { sale } = await doCheckout();
    await transactionService.voidTransaction(sale.id, {
      reason: "Pertama",
      voided_by: "Admin",
      adminUserId: admin.id,
    });

    await expect(
      transactionService.voidTransaction(sale.id, {
        reason: "Kedua",
        voided_by: "Admin",
        adminUserId: admin.id,
      }),
    ).rejects.toThrow("sudah dibatalkan sebelumnya");
  });
});
