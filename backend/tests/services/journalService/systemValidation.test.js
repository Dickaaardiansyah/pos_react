const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const journalService = require("../../../services/journalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("journalService.systemValidation", () => {
  test("mengembalikan hasil validasi sistem", async () => {
    await seedSystemAccounts();
    const result = await journalService.systemValidation({
      as_of_date: today(),
    });
    expect(result).toBeTruthy();
  });
});
