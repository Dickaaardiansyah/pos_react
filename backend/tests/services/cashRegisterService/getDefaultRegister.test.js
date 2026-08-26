// tests/services/cashRegisterService/getDefaultRegister.test.js
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const cashRegisterService = require("../../../services/cashRegisterService");
const { seedRegisterOnly } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("cashRegisterService.getDefaultRegister", () => {
  test("null jika belum ada laci", async () => {
    const reg = await cashRegisterService.getDefaultRegister();
    expect(reg == null).toBe(true);
  });

  test("mengembalikan laci aktif pertama", async () => {
    await seedRegisterOnly();
    const reg = await cashRegisterService.getDefaultRegister();
    expect(reg).not.toBeNull();
    expect(reg.name).toBeTruthy();
    expect(Number(reg.is_active)).toBe(1);
  });
});
