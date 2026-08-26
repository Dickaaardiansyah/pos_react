const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const capitalService = require("../../../services/capitalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("capitalService.list", () => {
  test("kosong: data=[], total=0", async () => {
    const result = await capitalService.list({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("setelah record: muncul di list", async () => {
    await seedSystemAccounts();
    const tx = await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 100000,
        target_account: "kas",
        payment_source: "kantor",
      },
      admin,
    );
    const result = await capitalService.list({});
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.find((r) => r.id === tx.id)).toBeDefined();
  });

  test("filter type=setoran", async () => {
    await seedSystemAccounts();
    await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 50000,
        target_account: "bank",
      },
      admin,
    );
    const result = await capitalService.list({ type: "setoran" });
    expect(result.data.every((r) => r.type === "setoran")).toBe(true);
  });
});
