// tests/services/payableService/list.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const { seedSystemAccounts, futureDueDate } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("payableService.list", () => {
  test("kosong jika belum ada hutang", async () => {
    const result = await payableService.list({});
    expect(Array.isArray(result) || Array.isArray(result?.data)).toBe(true);
    const rows = Array.isArray(result) ? result : result.data;
    expect(rows).toHaveLength(0);
  });

  test("menampilkan hutang yang dibuat", async () => {
    await seedSystemAccounts();
    const p = await payableService.create({
      supplier_name: "List Supplier",
      amount: 12000,
      due_date: futureDueDate(),
    });
    const result = await payableService.list({});
    const rows = Array.isArray(result) ? result : result.data;
    expect(rows.find((r) => r.id === p.id)).toBeDefined();
  });

  test("filter status", async () => {
    await seedSystemAccounts();
    await payableService.create({
      supplier_name: "Belum Lunas",
      amount: 5000,
      due_date: futureDueDate(),
    });
    const result = await payableService.list({ status: "belum_lunas" });
    const rows = Array.isArray(result) ? result : result.data;
    expect(rows.every((r) => r.status === "belum_lunas")).toBe(true);
  });
});
