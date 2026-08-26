// tests/services/productService/createCategory.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — productService.createCategory (SATU FUNGSI SAJA)
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const {
  productService,
  ValidationError,
} = require("../../../services/productService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

async function findCategoryByName(name) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT * FROM categories WHERE name = ?",
    [name],
  );
  return row || null;
}

describe("productService.createCategory", () => {
  test("menolak jika nama kosong", async () => {
    await expect(
      productService.createCategory({ name: "", description: "x" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      productService.createCategory({ name: null }),
    ).rejects.toThrow("Nama kategori wajib diisi");
  });

  test("berhasil membuat kategori baru dan mengembalikan baris lengkap", async () => {
    const result = await productService.createCategory({
      name: "Minuman Dingin",
      description: "Es & soda",
    });

    expect(result).toMatchObject({
      name: "Minuman Dingin",
      description: "Es & soda",
    });
    expect(result.id).toBeGreaterThan(0);

    const row = await findCategoryByName("Minuman Dingin");
    expect(row).not.toBeNull();
    expect(row.id).toBe(result.id);
  });

  test("description opsional: default string kosong di DB", async () => {
    const result = await productService.createCategory({ name: "Snack" });
    expect(result.name).toBe("Snack");
    const row = await findCategoryByName("Snack");
    expect(row.description === "" || row.description == null).toBe(true);
  });
});
