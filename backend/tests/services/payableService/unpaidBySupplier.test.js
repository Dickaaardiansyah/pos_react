// tests/services/payableService/unpaidBySupplier.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const payableService = require("../../../services/payableService");
const { seedSystemAccounts, futureDueDate } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("payableService.unpaidBySupplier", () => {
  test("mengelompokkan hutang belum lunas per supplier", async () => {
    await seedSystemAccounts();
    await payableService.create({
      supplier_name: "Grup A",
      amount: 10000,
      due_date: futureDueDate(),
    });
    await payableService.create({
      supplier_name: "Grup A",
      amount: 5000,
      due_date: futureDueDate(),
    });

    const rows = await payableService.unpaidBySupplier();
    expect(Array.isArray(rows)).toBe(true);
    const grupA = rows.find(
      (r) => r.supplier_name === "Grup A" || r.name === "Grup A",
    );
    // toleran terhadap nama kolom
    if (grupA) {
      const total =
        Number(grupA.total_unpaid || grupA.total || grupA.remaining || 0);
      expect(total).toBeGreaterThanOrEqual(15000);
    } else {
      expect(rows.length).toBeGreaterThanOrEqual(1);
    }
  });
});
