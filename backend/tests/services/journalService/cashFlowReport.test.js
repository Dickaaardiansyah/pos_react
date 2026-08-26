const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("journalService.cashFlowReport", () => {
  test("struktur laporan arus kas", async () => {
    await seedSystemAccounts();
    const report = await journalService.cashFlowReport({
      start_date: today(),
      end_date: today(),
    });
    expect(report).toBeTruthy();
  });
});
