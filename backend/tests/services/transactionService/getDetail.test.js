// tests/services/transactionService/getDetail.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.getDetail (SATU FUNGSI SAJA)
// Header transaksi + array items; NotFound jika id salah.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const {
  transactionService,
} = require("../../../services/transactionService");
const { NotFoundError } = require("../../../services/productService");
const { seedCheckoutReady } = require("./helpers");

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

describe("transactionService.getDetail", () => {
  test("melempar NotFoundError jika id tidak ada", async () => {
    await expect(transactionService.getDetail(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("mengembalikan header + items setelah checkout", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: {
        barcode: "DET1",
        name: "Detail Produk",
        price: 12000,
        stock: 30,
      },
    });
    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 2 }],
        payment_method: "cash",
        payment_amount: 30000,
        notes: "Catatan test",
      },
      kasir,
    );

    const detail = await transactionService.getDetail(sale.id);
    expect(detail.id).toBe(sale.id);
    expect(detail.transaction_code).toBe(sale.transaction_code);
    expect(detail.notes).toBe("Catatan test");
    expect(detail.cashier_name).toBe("Kasir Test");
    expect(Array.isArray(detail.items)).toBe(true);
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].product_name).toBe("Detail Produk");
    expect(Number(detail.items[0].quantity)).toBe(2);
    expect(Number(detail.items[0].unit_price)).toBe(12000);
  });
});
