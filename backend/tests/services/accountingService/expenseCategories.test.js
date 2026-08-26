const accountingService = require("../../../services/accountingService");

describe("accountingService.expenseCategories", () => {
  test("daftar kategori biaya operasional", () => {
    const list = accountingService.expenseCategories();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list.map((c) => c.id)).toContain("gaji");
    expect(list.map((c) => c.id)).toContain("sewa");
    expect(list[0]).toHaveProperty("label");
  });
});
