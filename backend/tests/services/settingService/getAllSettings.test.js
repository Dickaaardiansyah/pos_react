// tests/services/settingService/getAllSettings.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TEST — settingService.getAllSettings (SATU FUNGSI SAJA)
// Baca key-value settings; value JSON di-parse jika valid.
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

async function upsertSetting(key, value) {
  const pool = getPool();
  await pool.query(
    "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [key, value],
  );
}

describe("settingService.getAllSettings", () => {
  test("mengembalikan object kosong jika tabel settings kosong", async () => {
    const settings = await settingService.getAllSettings();
    expect(settings).toEqual({});
  });

  test("string biasa dikembalikan apa adanya", async () => {
    await upsertSetting("store_name", "Toko Maju");
    await upsertSetting("currency", "IDR");

    const settings = await settingService.getAllSettings();
    expect(settings.store_name).toBe("Toko Maju");
    expect(settings.currency).toBe("IDR");
  });

  test("value yang valid JSON di-parse jadi object/array/number/boolean", async () => {
    await upsertSetting("tax_enabled", "true"); // JSON true → boolean
    await upsertSetting("tax_rate", "11");
    await upsertSetting("features", JSON.stringify({ loyalty: true, multi: 2 }));

    const settings = await settingService.getAllSettings();
    expect(settings.tax_enabled).toBe(true);
    expect(settings.tax_rate).toBe(11);
    expect(settings.features).toEqual({ loyalty: true, multi: 2 });
  });

  test("value non-JSON (plain text) tetap string", async () => {
    await upsertSetting("receipt_footer", "Terima kasih sudah belanja");
    const settings = await settingService.getAllSettings();
    expect(settings.receipt_footer).toBe("Terima kasih sudah belanja");
  });
});
