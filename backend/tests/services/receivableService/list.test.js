// tests/services/receivableService/list.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const { insertReceivable } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("receivableService.list", () => {
  test("kosong jika belum ada data", async () => {
    const result = await receivableService.list({});
    const rows = Array.isArray(result) ? result : result?.rows || result?.data || [];
    expect(rows).toHaveLength(0);
  });

  test("menampilkan piutang yang di-seed", async () => {
    const id = await insertReceivable({
      customerName: "List Customer",
      amount: 12000,
    });
    const result = await receivableService.list({});
    const rows = Array.isArray(result) ? result : result?.rows || result?.data || [];
    expect(rows.find((r) => r.id === id)).toBeDefined();
  });

  test("filter status belum_lunas", async () => {
    await insertReceivable({ amount: 5000, status: "belum_lunas" });
    const result = await receivableService.list({ status: "belum_lunas" });
    const rows = Array.isArray(result) ? result : result?.rows || result?.data || [];
    expect(rows.every((r) => r.status === "belum_lunas")).toBe(true);
  });
});
