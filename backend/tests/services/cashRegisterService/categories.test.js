// tests/services/cashRegisterService/categories.test.js
// cashOutCategories & cashInCategories (sync, no DB)
const cashRegisterService = require("../../../services/cashRegisterService");

describe("cashRegisterService categories", () => {
  test("cashOutCategories mengembalikan daftar kategori keluar", () => {
    const list = cashRegisterService.cashOutCategories();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("label");
    expect(list.map((c) => c.id)).toContain("sedekah_donasi");
  });

  test("cashInCategories mengembalikan daftar kategori masuk", () => {
    const list = cashRegisterService.cashInCategories();
    expect(Array.isArray(list)).toBe(true);
    expect(list.map((c) => c.id)).toContain("setoran_modal");
  });
});
