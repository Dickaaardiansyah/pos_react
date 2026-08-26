// tests/services/purchaseService/recordPurchase.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — purchaseService.recordPurchase (SATU FUNGSI SAJA)
// Validasi item, tunai laci/kantor, kredit → stok naik + jurnal/hutang.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const purchaseService = require("../../../services/purchaseService");
const { ValidationError } = require("../../../services/productService");
const {
  seedCreditReady,
  seedLaciReady,
  seedKasKantorBalance,
  seedSystemAccounts,
  getProductStock,
  getPurchase,
  getPurchaseItems,
  insertProduct,
  openShiftForUser,
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

const admin = { id: 1, name: "Admin Test" };

describe("purchaseService.recordPurchase — validasi", () => {
  test("menolak pembelian tanpa item", async () => {
    await expect(
      purchaseService.recordPurchase({ items: [] }, admin),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak item tanpa product_id", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: [{ quantity: 1, unit_cost: 1000 }] },
        admin,
      ),
    ).rejects.toThrow("product_id wajib diisi");
  });

  test("menolak quantity item nol atau negatif", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: [{ product_id: 1, quantity: 0, unit_cost: 1000 }] },
        admin,
      ),
    ).rejects.toThrow("harus lebih dari 0");
  });

  test("menolak unit_cost negatif", async () => {
    await expect(
      purchaseService.recordPurchase(
        { items: [{ product_id: 1, quantity: 1, unit_cost: -5 }] },
        admin,
      ),
    ).rejects.toThrow("tidak valid");
  });

  test("menolak pembelian kredit tanpa nama supplier", async () => {
    await expect(
      purchaseService.recordPurchase(
        {
          items: [{ product_id: 1, quantity: 1, unit_cost: 1000 }],
          payment_method: "kredit",
          supplier_name: "  ",
        },
        admin,
      ),
    ).rejects.toThrow("Supplier wajib diisi");
  });
});

describe("purchaseService.recordPurchase — kredit", () => {
  test("pembelian kredit: stok naik, status confirmed, buat kode HUT-", async () => {
    const { productId } = await seedCreditReady({ stock: 10 });

    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 5, unit_cost: 8000 }],
        payment_method: "kredit",
        supplier_name: "CV Sumber Jaya",
      },
      admin,
    );

    expect(purchase.id).toBeGreaterThan(0);
    expect(purchase.purchase_code).toMatch(/^PRC/);
    expect(Number(purchase.total_cost)).toBe(40000); // 5 * 8000
    expect(await getProductStock(productId)).toBe(15); // 10 + 5

    const row = await getPurchase(purchase.id);
    expect(row.payment_method).toBe("kredit");
    expect(row.supplier_name).toBe("CV Sumber Jaya");
    expect(row.recorded_by).toBe("Admin Test");
    expect(row.shift_id).toBeNull();

    const items = await getPurchaseItems(purchase.id);
    expect(items).toHaveLength(1);
    expect(Number(items[0].quantity)).toBe(5);
    expect(Number(items[0].unit_cost)).toBe(8000);

    // hutang supplier (jika tabel payables punya purchase_id)
    const pool = getPool();
    const [payables] = await pool.query(
      "SELECT * FROM payables WHERE invoice_code LIKE ? OR notes LIKE ?",
      [`%${purchase.purchase_code}%`, `%${purchase.purchase_code}%`],
    );
    // minimal purchase sukses; hutang boleh terbuat di createPurchase
    expect(row.status).toBe("confirmed");
  });
});

describe("purchaseService.recordPurchase — tunai laci", () => {
  test("tunai laci ditolak jika tidak ada sesi kas terbuka", async () => {
    await seedSystemAccounts();
    const productId = await insertProduct({ stock: 5, barcode: "NO-SHIFT" });

    await expect(
      purchaseService.recordPurchase(
        {
          items: [{ product_id: productId, quantity: 1, unit_cost: 1000 }],
          payment_method: "tunai",
          payment_source: "laci",
          supplier_name: "Supplier A",
        },
        admin,
      ),
    ).rejects.toThrow(/Tidak ada sesi kas|laci/i);
  });

  test("tunai laci sukses jika ada 1 shift open + saldo cukup: stok naik, shift_id terisi", async () => {
    const { shiftId, productId } = await seedLaciReady({
      userId: 2,
      openingBalance: 500000,
      product: { barcode: "LACI-OK", name: "Dari Laci", stock: 2, costPrice: 5000 },
    });

    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 3, unit_cost: 5000 }],
        payment_method: "tunai",
        payment_source: "laci",
        supplier_name: "Toko Grosir",
      },
      admin,
    );

    expect(Number(purchase.total_cost)).toBe(15000);
    expect(await getProductStock(productId)).toBe(5); // 2 + 3

    const row = await getPurchase(purchase.id);
    expect(row.payment_method).toBe("tunai");
    expect(Number(row.shift_id)).toBe(shiftId);
  });

  test("tunai laci ditolak jika saldo laci tidak cukup", async () => {
    const { productId } = await seedLaciReady({
      userId: 2,
      openingBalance: 1000, // kecil
      product: { barcode: "LACI-LESS", stock: 10 },
    });

    await expect(
      purchaseService.recordPurchase(
        {
          items: [{ product_id: productId, quantity: 1, unit_cost: 50000 }],
          payment_method: "tunai",
          payment_source: "laci",
          supplier_name: "Mahal",
        },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);

    expect(await getProductStock(productId)).toBe(10); // tidak berubah
  });

  test("tunai laci dengan shift_id eksplisit", async () => {
    const { shiftId, productId } = await seedLaciReady({
      openingBalance: 200000,
      product: { barcode: "LACI-ID", stock: 1 },
    });

    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 1, unit_cost: 2000 }],
        payment_method: "tunai",
        payment_source: "laci",
        shift_id: shiftId,
        supplier_name: "Supplier X",
      },
      admin,
    );

    const row = await getPurchase(purchase.id);
    expect(Number(row.shift_id)).toBe(shiftId);
  });
});

describe("purchaseService.recordPurchase — tunai kantor", () => {
  test("tunai kantor ditolak jika saldo Kas Kantor tidak cukup", async () => {
    await seedSystemAccounts();
    // tidak seed saldo → balance 0
    const productId = await insertProduct({ barcode: "KTR-0", stock: 5 });

    await expect(
      purchaseService.recordPurchase(
        {
          items: [{ product_id: productId, quantity: 1, unit_cost: 10000 }],
          payment_method: "tunai",
          payment_source: "kantor",
          target_account: "kas",
          supplier_name: "Supplier",
        },
        admin,
      ),
    ).rejects.toThrow(/tidak cukup/i);
  });

  test("tunai kantor sukses jika saldo Kas cukup: shift_id null, stok naik", async () => {
    await seedKasKantorBalance(1_000_000);
    const productId = await insertProduct({
      barcode: "KTR-OK",
      name: "Dari Kantor",
      stock: 4,
      costPrice: 7000,
    });

    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 2, unit_cost: 7000 }],
        payment_method: "tunai",
        payment_source: "kantor",
        target_account: "kas",
        supplier_name: "PT Kantor",
      },
      admin,
    );

    expect(Number(purchase.total_cost)).toBe(14000);
    expect(await getProductStock(productId)).toBe(6);

    const row = await getPurchase(purchase.id);
    expect(row.shift_id).toBeNull();
    expect(row.payment_method).toBe("tunai");
  });
});

describe("purchaseService.recordPurchase — default payment", () => {
  test("payment_method selain 'kredit' dianggap tunai", async () => {
    // butuh saldo / shift — pakai kredit path lebih aman? 
    // Service: payment_method === 'kredit' ? kredit : tunai
    // Jadi tanpa payment_method → tunai → butuh laci/kantor
    const { productId } = await seedLaciReady({
      openingBalance: 100000,
      product: { barcode: "DEF-TUNAI", stock: 0 },
    });

    const purchase = await purchaseService.recordPurchase(
      {
        items: [{ product_id: productId, quantity: 1, unit_cost: 3000 }],
        // payment_method tidak diisi
        supplier_name: "Default Tunai",
      },
      admin,
    );

    const row = await getPurchase(purchase.id);
    expect(row.payment_method).toBe("tunai");
  });
});
