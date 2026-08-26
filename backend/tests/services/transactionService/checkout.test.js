// tests/services/transactionService/checkout.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — transactionService.checkout (SATU FUNGSI SAJA)
// Validasi item/open bill/shift, kurangi stok, simpan transaksi + jurnal.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const {
  transactionService,
} = require("../../../services/transactionService");
const { ValidationError } = require("../../../services/productService");
const {
  seedCheckoutReady,
  getProductStock,
  getTransaction,
  getTransactionItems,
  countJournalByReference,
  insertProduct,
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

// user seed: admin=1, kasir=2
const kasir = { id: 2, name: "Kasir Test" };

describe("transactionService.checkout", () => {
  test("menolak checkout tanpa item", async () => {
    await expect(
      transactionService.checkout({ items: [], payment_method: "cash" }, kasir),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak checkout Open Bill tanpa nama pelanggan", async () => {
    await expect(
      transactionService.checkout(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: "open_bill",
          customer_name: "  ",
        },
        kasir,
      ),
    ).rejects.toThrow("Pelanggan wajib dipilih");
  });

  test("menolak checkout jika kasir belum membuka sesi kas", async () => {
    // tidak seed shift
    await expect(
      transactionService.checkout(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: "cash",
          payment_amount: 10000,
        },
        kasir,
      ),
    ).rejects.toThrow("Tidak ada sesi kas yang sedang Anda buka");
  });

  test("checkout tunai sukses: stok berkurang, transaksi + item + jurnal tersimpan, cashier dari token", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "CHK1", name: "Teh Botol", price: 5000, costPrice: 3000, stock: 50 },
    });

    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 2 }],
        payment_method: "cash",
        payment_amount: 20000,
        // percobaan memalsukan identitas — harus diabaikan
        cashier_id: 999,
        cashier_name: "Bukan Kasir",
      },
      kasir,
    );

    expect(sale.id).toBeGreaterThan(0);
    expect(sale.transaction_code).toMatch(/^TSR/);
    expect(Number(sale.total_amount)).toBe(10000); // 2 * 5000
    expect(Number(sale.final_amount)).toBe(10000);
    expect(Number(sale.change_amount)).toBe(10000); // bayar 20k
    expect(sale.cashier_name).toBe("Kasir Test");
    expect(sale.status).toBe("completed");
    expect(sale.items).toHaveLength(1);

    // stok di DB
    expect(await getProductStock(productId)).toBe(48);

    // baris transaksi
    const tx = await getTransaction(sale.id);
    expect(tx.cashier_id).toBe(kasir.id);
    expect(tx.cashier_name).toBe("Kasir Test");
    expect(tx.shift_id).toBeTruthy();
    expect(tx.payment_method).toBe("cash");

    const items = await getTransactionItems(sale.id);
    expect(items).toHaveLength(1);
    expect(Number(items[0].quantity)).toBe(2);
    expect(Number(items[0].unit_price)).toBe(5000);

    // jurnal otomatis ter-posting
    expect(await countJournalByReference(sale.transaction_code)).toBeGreaterThanOrEqual(1);
  });

  test("checkout menolak jika stok tidak mencukupi — stok tidak berubah", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "CHK2", name: "Stok Tipis", price: 1000, stock: 3 },
    });

    await expect(
      transactionService.checkout(
        {
          items: [{ product_id: productId, quantity: 10 }],
          payment_method: "cash",
          payment_amount: 10000,
        },
        kasir,
      ),
    ).rejects.toMatchObject({ status: 400 });

    expect(await getProductStock(productId)).toBe(3);
  });

  test("checkout menolak pembayaran kurang dari total", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "CHK3", name: "Mahal", price: 15000, stock: 10 },
    });

    await expect(
      transactionService.checkout(
        {
          items: [{ product_id: productId, quantity: 1 }],
          payment_method: "cash",
          payment_amount: 5000, // kurang
        },
        kasir,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  test("checkout Open Bill: buat piutang + invoice PIU-", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "CHK4", name: "Kredit", price: 20000, stock: 5 },
    });

    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 1 }],
        payment_method: "open_bill",
        customer_name: "Toko Langganan",
        payment_amount: 0,
      },
      kasir,
    );

    expect(sale.receivable).toBeTruthy();
    expect(sale.receivable.invoice_code).toMatch(/^PIU-/);
    expect(Number(sale.receivable.amount)).toBe(20000);
    expect(sale.receivable.status).toBe("belum_lunas");
    expect(await getProductStock(productId)).toBe(4);

    const pool = getPool();
    const [[rec]] = await pool.query(
      "SELECT * FROM receivables WHERE transaction_id = ?",
      [sale.id],
    );
    expect(rec).not.toBeNull();
    expect(rec.customer_name).toBe("Toko Langganan");
  });

  test("checkout dengan diskon: final_amount = subtotal - diskon", async () => {
    const { productId } = await seedCheckoutReady({
      userId: kasir.id,
      product: { barcode: "CHK5", name: "Diskon", price: 10000, stock: 10 },
    });

    const sale = await transactionService.checkout(
      {
        items: [{ product_id: productId, quantity: 2 }],
        payment_method: "cash",
        payment_amount: 20000,
        discount_amount: 2000,
      },
      kasir,
    );

    expect(Number(sale.total_amount)).toBe(20000);
    expect(Number(sale.discount_amount)).toBe(2000);
    expect(Number(sale.final_amount)).toBe(18000);
  });

  test("produk tidak aktif / tidak ada: ditolak", async () => {
    await seedCheckoutReady({ userId: kasir.id });
    // product_id tidak ada
    await expect(
      transactionService.checkout(
        {
          items: [{ product_id: 999999, quantity: 1 }],
          payment_method: "cash",
          payment_amount: 10000,
        },
        kasir,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
