const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const capitalService = require("../../../services/capitalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("capitalService.summary", () => {
  test("tanpa modal: has_modal_awal false, modal_awal 0", async () => {
    await seedSystemAccounts();
    const s = await capitalService.summary({});
    expect(s.has_modal_awal).toBe(false);
    expect(s.modal_awal).toBe(0);
    expect(s).toHaveProperty("ekuitas_saat_ini");
    expect(s).toHaveProperty("status");
  });

  test("setelah Modal Awal: has_modal_awal true", async () => {
    await seedSystemAccounts();
    await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 10_000_000,
        is_initial: true,
        target_account: "kas",
        payment_source: "kantor",
      },
      admin,
    );
    const s = await capitalService.summary({});
    expect(s.has_modal_awal).toBe(true);
    expect(s.modal_awal).toBe(10000000);
    expect(s.tanggal_modal_awal).toBeTruthy();
  });
});
