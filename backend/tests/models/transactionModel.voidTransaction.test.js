// tests/models/transactionModel.voidTransaction.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Sebelum fix: hanya baris `transactions` yang dikunci FOR UPDATE — void
// tetap berhasil walau shift sumber transaksi ini sudah 'closed', sehingga
// snapshot cash_shifts.total_cash_sales pada shift closed itu jadi tidak
// sinkron dengan status transaksi yang sebenarnya.
// Sesudah fix: kalau tx.shift_id terisi, baris cash_shifts itu ikut
// dikunci (FOR UPDATE) & harus masih 'open' — mirror pola yang sama dengan
// cashRegisterModel.deleteMovement (lihat cashRegisterModel.test.js).
//
// Pola test: config/database di-mock supaya transaction(cb) memanggil
// cb(fakeConn) dengan conn.execute yang urutan return value-nya diatur
// manual — sama seperti tests/models/cashRegisterModel.test.js.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../config/database", () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  safeInt: jest.fn((v, fallback = 0) => Number(v) || fallback),
}));
jest.mock("../../services/journalService");

const database = require("../../config/database");
const journalService = require("../../services/journalService");
const transactionModel = require("../../models/transactionModel");
const { ValidationError } = require("../../services/productService");

let conn;

beforeEach(() => {
  jest.clearAllMocks();
  conn = { execute: jest.fn() };
  database.transaction.mockImplementation((cb) => cb(conn));
  journalService.postVoidSaleJournal.mockResolvedValue(undefined);
});

const OPEN_SHIFT = { id: 10, status: "open", shift_code: "KAS202608230001" };
const CLOSED_SHIFT = { ...OPEN_SHIFT, status: "closed" };

const TX = {
  id: 99,
  transaction_code: "TRX99",
  status: "completed",
  shift_id: 10,
  payment_amount: 50000,
};

describe("transactionModel.voidTransaction", () => {
  test("menolak (ValidationError) void transaksi jika shift terkait sudah closed", async () => {
    conn.execute
      .mockResolvedValueOnce([[TX]]) // lock transaksi
      .mockResolvedValueOnce([[CLOSED_SHIFT]]); // lock shift → sudah closed

    let caught;
    try {
      await transactionModel.voidTransaction(99, {
        reason: "salah input",
        voidedBy: "Admin",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught.message).toMatch(/sudah ditutup/);
    // Tidak boleh sempat mengembalikan stok / posting jurnal / mengubah
    // status transaksi kalau shift-nya sudah closed.
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(journalService.postVoidSaleJournal).not.toHaveBeenCalled();
  });

  test("mengunci baris cash_shifts dengan FOR UPDATE memakai tx.shift_id, sebelum lanjut ke item/piutang", async () => {
    conn.execute
      .mockResolvedValueOnce([[TX]]) // lock transaksi
      .mockResolvedValueOnce([[OPEN_SHIFT]]) // lock shift
      .mockResolvedValueOnce([[]]) // select transaction_items → kosong
      .mockResolvedValueOnce([[]]) // select receivables → kosong
      .mockResolvedValueOnce([{}]); // update transactions

    await transactionModel.voidTransaction(99, {
      reason: "salah input",
      voidedBy: "Admin",
    });

    const [sql, params] = conn.execute.mock.calls[1];
    expect(sql).toEqual(expect.stringContaining("FOR UPDATE"));
    expect(sql).toEqual(expect.stringContaining("cash_shifts"));
    expect(params).toEqual([10]);
  });

  test("berhasil void & posting jurnal ketika shift masih open", async () => {
    conn.execute
      .mockResolvedValueOnce([[TX]])
      .mockResolvedValueOnce([[OPEN_SHIFT]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}]);

    const result = await transactionModel.voidTransaction(99, {
      reason: "salah input",
      voidedBy: "Admin",
    });

    expect(result).toMatchObject({ id: 99, status: "cancelled" });
    expect(journalService.postVoidSaleJournal).toHaveBeenCalled();
  });

  test("transaksi lama tanpa shift_id (NULL) tidak memicu lock shift sama sekali", async () => {
    conn.execute
      .mockResolvedValueOnce([[{ ...TX, shift_id: null }]]) // lock transaksi
      .mockResolvedValueOnce([[]]) // select transaction_items
      .mockResolvedValueOnce([[]]) // select receivables
      .mockResolvedValueOnce([{}]); // update transactions

    await transactionModel.voidTransaction(99, {
      reason: "salah input",
      voidedBy: "Admin",
    });

    // Hanya 4 query total (tanpa query lock cash_shifts tambahan).
    expect(conn.execute).toHaveBeenCalledTimes(4);
  });
});
