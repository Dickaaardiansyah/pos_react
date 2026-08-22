// tests/models/cashRegisterModel.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — cashRegisterModel: bagian yang diuji di sini KHUSUS logika
// locking & re-validasi di dalam DB transaction (createMovement,
// deleteMovement, closeShift), bukan query CRUD sederhana lainnya.
//
// Beda dari pola test service (`models/*` di-mock total, murni menguji
// service), file ini justru menguji MODEL secara langsung memperbaiki bug yang letaknya di dalam model itu sendiri (race
// condition antara closeShift() dan createMovement()/deleteMovement() yang
// menyentuh baris cash_shifts yang sama). Untuk itu `config/database` di-mock
// supaya `transaction(cb)` memanggil `cb(fakeConn)` dengan fakeConn palsu
// yang bisa diatur urutan return value tiap `conn.execute()`-nya — tanpa
// menyentuh MySQL sungguhan, tapi tetap menguji urutan query & pengecekan
// yang benar-benar terjadi di dalam SATU transaction.
//
// Skenario inti yang diuji 
//   "Cash Out Rp200.000 dicatat kasir → kasir klik tutup kas → closeShift()
//   mengunci shift & membaca snapshot cash_movements → di saat hampir
//   bersamaan ada request hapus movement yang SUDAH lolos pemeriksaan awal
//   (shift masih 'open' saat itu) tapi baru dieksekusi SETELAH shift
//   benar-benar closed."
// Sebelum fix: deleteMovement() (dan createMovement()) tidak mengunci apa
// pun terhadap cash_shifts, sehingga tetap berhasil DELETE + posting jurnal
// pembalik walau shift sumbernya sudah closed — snapshot total_cash_out di
// closed shift jadi permanen tidak konsisten dengan cash_movements.
// Sesudah fix: keduanya ikut mengunci baris cash_shifts (FOR UPDATE) &
// memvalidasi ulang status/ownership DI DALAM transaction yang sama —
// kalau closeShift() menang lock duluan, request susulan ini gagal dengan
// ValidationError alih-alih tetap mengubah data pada shift yang sudah closed.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../config/database", () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  insert: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
  safeInt: jest.fn((v, fallback = 0) => Number(v) || fallback),
}));
jest.mock("../../services/journalService");

const database = require("../../config/database");
const journalService = require("../../services/journalService");
const cashRegisterModel = require("../../models/cashRegisterModel");
const {
  ValidationError,
  NotFoundError,
} = require("../../services/productService");
const { ForbiddenError } = require("../../middleware/auth");

let conn;

beforeEach(() => {
  jest.clearAllMocks();
  conn = { execute: jest.fn() };
  // transaction() asli = beginTransaction → callback(conn) → commit/rollback.
  // Untuk unit test, cukup jalankan callback dengan conn palsu & teruskan
  // hasil/errornya apa adanya (perilaku commit/rollback sungguhan tidak
  // relevan diuji di sini — itu tanggung jawab mysql2, bukan model).
  database.transaction.mockImplementation((cb) => cb(conn));
});

const OPEN_SHIFT = {
  id: 10,
  status: "open",
  shift_code: "KAS202608230001",
  opened_by_user_id: 5,
};

const CLOSED_SHIFT = { ...OPEN_SHIFT, status: "closed" };

describe("cashRegisterModel.createMovement (revisi dosen #20)", () => {
  const payload = {
    shiftId: 10,
    type: "out",
    category: "lainnya",
    amount: 200000,
    description: "Beli galon",
    createdBy: "Kasir A",
    createdByUserId: 5,
    occurredAt: "2026-08-23 10:00:00",
  };

  test("mengunci baris cash_shifts dengan FOR UPDATE sebelum insert apa pun", async () => {
    conn.execute
      .mockResolvedValueOnce([[OPEN_SHIFT]]) // lock shift
      .mockResolvedValueOnce([{ insertId: 55 }]) // insert cash_movements
      .mockResolvedValueOnce([[{ id: 55 }]]); // select hasil insert

    await cashRegisterModel.createMovement(payload);

    const [sql, params] = conn.execute.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining("FOR UPDATE"));
    expect(sql).toEqual(expect.stringContaining("cash_shifts"));
    expect(params).toEqual([10]);
  });

  test("menolak (ValidationError) jika shift sudah closed saat lock diperoleh — mencegah movement menempel ke shift yang baru saja ditutup", async () => {
    conn.execute.mockResolvedValueOnce([[CLOSED_SHIFT]]);

    let caught;
    try {
      await cashRegisterModel.createMovement(payload);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught.message).toMatch(/sudah ditutup/);
    // Tidak boleh ada INSERT cash_movements sama sekali kalau lock
    // menunjukkan shift sudah closed — hanya query lock yang terjadi.
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(journalService.postCashMovementJournal).not.toHaveBeenCalled();
  });

  test("melempar NotFoundError jika shift tidak ditemukan", async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    await expect(cashRegisterModel.createMovement(payload)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("menolak (ForbiddenError) jika shift terkunci milik kasir lain", async () => {
    conn.execute.mockResolvedValueOnce([
      [{ ...OPEN_SHIFT, opened_by_user_id: 999 }],
    ]);
    await expect(
      cashRegisterModel.createMovement({ ...payload, createdByUserId: 5 }),
    ).rejects.toThrow(ForbiddenError);
    expect(journalService.postCashMovementJournal).not.toHaveBeenCalled();
  });

  test("melewati pengecekan owner untuk shift legacy ber-owner NULL", async () => {
    conn.execute
      .mockResolvedValueOnce([[{ ...OPEN_SHIFT, opened_by_user_id: null }]])
      .mockResolvedValueOnce([{ insertId: 55 }])
      .mockResolvedValueOnce([[{ id: 55, shift_id: 10 }]]);

    await expect(
      cashRegisterModel.createMovement(payload),
    ).resolves.toMatchObject({ id: 55 });
  });

  test("insert cash_movements + posting jurnal terjadi memakai conn yang sama dengan lock, saat shift open & owner cocok", async () => {
    const insertedMovement = {
      id: 55,
      shift_id: 10,
      type: "out",
      amount: 200000,
    };
    conn.execute
      .mockResolvedValueOnce([[OPEN_SHIFT]])
      .mockResolvedValueOnce([{ insertId: 55 }])
      .mockResolvedValueOnce([[insertedMovement]]);

    const result = await cashRegisterModel.createMovement(payload);

    expect(result).toEqual(insertedMovement);
    expect(journalService.postCashMovementJournal).toHaveBeenCalledWith(
      insertedMovement,
      OPEN_SHIFT.shift_code,
      conn,
    );
  });
});

describe("cashRegisterModel.deleteMovement (revisi dosen #20)", () => {
  const MOVEMENT = { id: 77, shift_id: 10, type: "out", amount: 200000 };

  test("mengembalikan null tanpa menyentuh cash_shifts bila movement tidak ditemukan", async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    const result = await cashRegisterModel.deleteMovement(77, 5);
    expect(result).toBeNull();
    expect(conn.execute).toHaveBeenCalledTimes(1);
  });

  test("mengunci shift lewat movement.shift_id (bukan parameter lain) dengan FOR UPDATE", async () => {
    conn.execute
      .mockResolvedValueOnce([[MOVEMENT]])
      .mockResolvedValueOnce([[OPEN_SHIFT]])
      .mockResolvedValueOnce([{}]);

    await cashRegisterModel.deleteMovement(77, 5);

    const [sql, params] = conn.execute.mock.calls[1];
    expect(sql).toEqual(expect.stringContaining("FOR UPDATE"));
    expect(sql).toEqual(expect.stringContaining("cash_shifts"));
    expect(params).toEqual([MOVEMENT.shift_id]);
  });

  test("SKENARIO TEMUAN DOSEN: menolak (ValidationError) hapus movement jika shift-nya sudah closed di antara pemeriksaan awal & eksekusi delete — snapshot tutup kas tidak boleh jadi tidak konsisten", async () => {
    conn.execute
      .mockResolvedValueOnce([[MOVEMENT]])
      .mockResolvedValueOnce([[CLOSED_SHIFT]]);

    let caught;
    try {
      await cashRegisterModel.deleteMovement(77, 5);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught.message).toMatch(/sudah ditutup/);
    // DELETE cash_movements TIDAK boleh sempat dijalankan — hanya lookup
    // movement + lock shift yang terjadi.
    expect(conn.execute).toHaveBeenCalledTimes(2);
    expect(journalService.postVoidCashMovementJournal).not.toHaveBeenCalled();
  });

  test("melempar NotFoundError jika shift terkait movement tidak ditemukan", async () => {
    conn.execute
      .mockResolvedValueOnce([[MOVEMENT]])
      .mockResolvedValueOnce([[]]);
    await expect(cashRegisterModel.deleteMovement(77, 5)).rejects.toThrow(
      NotFoundError,
    );
  });

  test("menolak (ForbiddenError) jika shift terkunci milik kasir lain", async () => {
    conn.execute
      .mockResolvedValueOnce([[MOVEMENT]])
      .mockResolvedValueOnce([[{ ...OPEN_SHIFT, opened_by_user_id: 999 }]]);
    await expect(cashRegisterModel.deleteMovement(77, 5)).rejects.toThrow(
      ForbiddenError,
    );
    expect(journalService.postVoidCashMovementJournal).not.toHaveBeenCalled();
  });

  test("melewati pengecekan owner untuk shift legacy ber-owner NULL", async () => {
    conn.execute
      .mockResolvedValueOnce([[MOVEMENT]])
      .mockResolvedValueOnce([[{ ...OPEN_SHIFT, opened_by_user_id: null }]])
      .mockResolvedValueOnce([{}]);
    await expect(cashRegisterModel.deleteMovement(77, 5)).resolves.toEqual(
      MOVEMENT,
    );
  });

  test("menghapus movement + posting jurnal pembalik ketika shift masih open & owner cocok", async () => {
    conn.execute
      .mockResolvedValueOnce([[MOVEMENT]])
      .mockResolvedValueOnce([[OPEN_SHIFT]])
      .mockResolvedValueOnce([{}]);

    const result = await cashRegisterModel.deleteMovement(77, 5);

    expect(result).toEqual(MOVEMENT);
    expect(journalService.postVoidCashMovementJournal).toHaveBeenCalledWith(
      MOVEMENT,
      OPEN_SHIFT.shift_code,
      conn,
    );
    const deleteCall = conn.execute.mock.calls[2];
    expect(deleteCall[0]).toEqual(
      expect.stringContaining("DELETE FROM cash_movements"),
    );
    expect(deleteCall[1]).toEqual([77]);
  });
});

describe("cashRegisterModel.closeShift (revisi dosen #13/#18 — regresi untuk pola lock yang sama)", () => {
  const closePayload = {
    closingBalancePhysical: 900000,
    closingNotes: "",
    closedBy: "Admin",
    closedByUserId: 5,
    occurredAt: "2026-08-23 20:00:00",
    buildSummary: jest.fn(),
  };

  test("menolak (ValidationError) menutup shift yang sudah closed, TANPA memanggil buildSummary — mencegah double posting jurnal selisih", async () => {
    conn.execute.mockResolvedValueOnce([[CLOSED_SHIFT]]);
    const buildSummary = jest.fn();

    await expect(
      cashRegisterModel.closeShift(10, { ...closePayload, buildSummary }),
    ).rejects.toThrow(ValidationError);
    expect(buildSummary).not.toHaveBeenCalled();
    expect(conn.execute).toHaveBeenCalledTimes(1);
  });

  test("melempar NotFoundError jika shift tidak ditemukan", async () => {
    conn.execute.mockResolvedValueOnce([[]]);
    await expect(
      cashRegisterModel.closeShift(10, closePayload),
    ).rejects.toThrow(NotFoundError);
  });

  test("memanggil buildSummary dengan baris shift HASIL LOCK (bukan snapshot lama), lalu commit UPDATE + posting jurnal", async () => {
    const summary = {
      expected_balance: 900000,
      total_cash_sales: 100000,
      total_cash_in: 0,
      total_cash_out: 200000,
      total_cash_receivable: 0,
      total_cash_payable: 0,
      total_cash_purchase: 0,
      total_cash_capital_in: 0,
      total_cash_capital_out: 0,
      total_cash_expense: 0,
    };
    const buildSummary = jest.fn().mockResolvedValue(summary);
    const closedRow = { ...OPEN_SHIFT, status: "closed" };

    conn.execute
      .mockResolvedValueOnce([[OPEN_SHIFT]]) // lock
      .mockResolvedValueOnce([{}]) // UPDATE
      .mockResolvedValueOnce([[closedRow]]); // re-select setelah UPDATE

    const result = await cashRegisterModel.closeShift(10, {
      ...closePayload,
      buildSummary,
    });

    expect(buildSummary).toHaveBeenCalledWith(OPEN_SHIFT);
    expect(result).toEqual(closedRow);
    expect(journalService.postCashShiftCloseJournal).toHaveBeenCalledWith(
      closedRow,
      conn,
    );
  });
});
