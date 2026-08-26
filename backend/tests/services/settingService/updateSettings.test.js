// tests/services/settingService/updateSettings.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.updateSettings (SATU FUNGSI SAJA)
// Upsert banyak key sekaligus; object di-JSON.stringify.
// Konek ke database MySQL asli (pos_refactor_test), TIDAK memakai mock.
// ─────────────────────────────────────────────────────────────────────────────
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const { getPool } = require("../../../config/database");
const { settingService } = require("../../../services/settingService");

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDatabase();
});

async function getRawSetting(key) {
  const pool = getPool();
  const [[row]] = await pool.query(
    "SELECT `value` FROM settings WHERE `key` = ?",
    [key],
  );
  return row ? row.value : null;
}

describe("settingService.updateSettings", () => {
  test("menyimpan beberapa key string sekaligus", async () => {
    await settingService.updateSettings({
      store_name: "Toko Baru",
      store_phone: "08123456789",
    });

    expect(await getRawSetting("store_name")).toBe("Toko Baru");
    expect(await getRawSetting("store_phone")).toBe("08123456789");
  });

  test("object di-serialize jadi JSON string di DB", async () => {
    await settingService.updateSettings({
      features: { loyalty: true, points: 10 },
    });

    const raw = await getRawSetting("features");
    expect(JSON.parse(raw)).toEqual({ loyalty: true, points: 10 });
  });

  test("update key yang sudah ada: value diganti (upsert)", async () => {
    await settingService.updateSettings({ store_name: "Lama" });
    await settingService.updateSettings({ store_name: "Baru" });

    expect(await getRawSetting("store_name")).toBe("Baru");
  });

  test("setelah update, getAllSettings mencerminkan nilai baru", async () => {
    await settingService.updateSettings({
      currency: "IDR",
      tax_rate: "11",
    });
    const settings = await settingService.getAllSettings();
    expect(settings.currency).toBe("IDR");
    // "11" valid JSON number → getAllSettings parse jadi number
    expect(settings.tax_rate).toBe(11);
  });
});
