const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const capitalService = require("../../../services/capitalService");
const { seedSystemAccounts, today } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

const admin = { id: 1, name: "Admin Test" };

describe("capitalService.equityStatement", () => {
  test("struktur laporan perubahan modal", async () => {
    await seedSystemAccounts();
    const stmt = await capitalService.equityStatement({});
    expect(stmt).toHaveProperty("start_date");
    expect(stmt).toHaveProperty("end_date");
    expect(stmt).toHaveProperty("modal_awal");
    expect(stmt).toHaveProperty("setoran_periode");
    expect(stmt).toHaveProperty("penarikan_periode");
    expect(stmt).toHaveProperty("laba_rugi_periode");
    expect(stmt).toHaveProperty("modal_akhir");
    expect(stmt).toHaveProperty("selisih_pengecekan");
  });

  test("setelah setoran: setoran_periode > 0", async () => {
    await seedSystemAccounts();
    await capitalService.record(
      {
        transaction_date: today(),
        type: "setoran",
        amount: 250000,
        target_account: "kas",
        payment_source: "kantor",
      },
      admin,
    );
    const t = today();
    const stmt = await capitalService.equityStatement({
      start_date: t,
      end_date: t,
    });
    expect(stmt.setoran_periode).toBeGreaterThanOrEqual(250000);
  });
});
