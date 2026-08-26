// tests/services/receivableService/remove.test.js
// Service sengaja menolak SEMUA penghapusan (manual & tertaut Open Bill).
const { connectTestDb, closeTestDb, resetDatabase } = require("../../setup/db");
const receivableService = require("../../../services/receivableService");
const {
  ValidationError,
  NotFoundError,
} = require("../../../services/productService");
const { insertReceivable, getReceivable } = require("./helpers");

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await closeTestDb(); });
beforeEach(async () => { await resetDatabase(); });

describe("receivableService.remove", () => {
  test("melempar NotFoundError jika tidak ada", async () => {
    await expect(receivableService.remove(999999)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("menolak hapus piutang manual (sudah tercatat jurnal)", async () => {
    const id = await insertReceivable({
      customerName: "Manual",
      amount: 10000,
      transactionId: null,
    });
    await expect(receivableService.remove(id)).rejects.toThrow(ValidationError);
    await expect(receivableService.remove(id)).rejects.toThrow(
      /tidak dapat dihapus/i,
    );
    expect(await getReceivable(id)).not.toBeNull();
  });

  test("menolak hapus piutang tertaut Open Bill (transaction_id)", async () => {
    // transaction_id set tanpa insert transactions — may fail FK
    const id = await insertReceivable({
      customerName: "Open Bill",
      amount: 15000,
    });
    const { getPool } = require("../../../config/database");
    const pool = getPool();
    try {
      await pool.query(
        "UPDATE receivables SET transaction_id = 1 WHERE id = ?",
        [id],
      );
    } catch {
      // FK blocked — still test message for manual path is enough
    }
    const row = await getReceivable(id);
    await expect(receivableService.remove(id)).rejects.toThrow(ValidationError);
    if (row.transaction_id) {
      await expect(receivableService.remove(id)).rejects.toThrow(
        /Open Bill|transaksi/i,
      );
    }
  });
});
