// tests/config/database.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — config/database.js (revisi dosen #20: test case untuk skenario
// error yang SERING kejadian di lapangan tapi belum pernah diuji otomatis:
//   - migrasi belum dijalankan  → tabel/kolom belum ada (ER_NO_SUCH_TABLE /
//     ER_BAD_FIELD_ERROR)
//   - ENUM salah                → nilai di luar daftar ENUM kolom (mode
//     STRICT MariaDB/MySQL menolaknya sebagai error, bukan sekadar warning)
//   - FK salah                  → insert menunjuk id induk yang tidak ada
//     (ER_NO_REFERENCED_ROW_2), atau hapus baris yang masih direferensikan
//     (ER_ROW_IS_REFERENCED_2)
//   - DB_NAME mismatch           → nama database di .env tidak cocok dengan
//     yang ada di server MySQL (ER_BAD_DB_ERROR)
//
// mysql2/promise di-mock total — tidak ada koneksi MySQL sungguhan yang
// dibuka. Yang diuji murni: (a) apakah error dari driver diteruskan APA
// ADANYA (kode & pesan asli tidak boleh "ketelan"/diubah jadi generic error,
// supaya lapisan model/service di atasnya masih bisa membedakan jenis error),
// dan (b) apakah initializeDatabase() menghentikan proses (process.exit(1))
// saat koneksi awal gagal, alih-alih membiarkan server jalan dengan pool
// yang rusak.
//
// CATATAN TEKNIS: sengaja TIDAK memakai jest.resetModules() di sini. Modul
// ini (config/database.js) menyimpan pool koneksi di variabel level-modul
// (`let pool`), jadi kalau module registry di-reset di tengah test, mock
// `mysql2/promise` yang sudah di-require di atas jadi instance yang BEDA
// dari yang dipakai config/database.js versi baru hasil reset — akibatnya
// `mysql.createPool.mockReturnValue(...)` tidak lagi berpengaruh, dan
// initializeDatabase() bisa jatuh ke process.exit(1) yang SUNGGUHAN
// (mematikan proses test runner). Untuk menghindari itu, mysql2/promise &
// config/database di-require SEKALI di scope modul test, lalu tiap test
// cukup mengganti mockReturnValue/mockResolvedValue-nya saja.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("mysql2/promise", () => ({
  createPool: jest.fn(),
}));

const mysql = require("mysql2/promise");
const database = require("../../config/database");

// Helper bikin error mysql2 palsu — bentuknya sama seperti error asli
// mysql2/MariaDB: punya .code, .errno, .sqlState, dan .message.
function mysqlError(message, code, errno, sqlState) {
  return Object.assign(new Error(message), { code, errno, sqlState });
}

describe("initializeDatabase() — koneksi awal & DB_NAME mismatch (revisi dosen #20)", () => {
  let originalExit;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    originalExit = process.exit;
    process.exit = jest.fn();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "table").mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    jest.restoreAllMocks();
  });

  test("DB_NAME salah/tidak ada di server → getConnection() gagal dengan ER_BAD_DB_ERROR, server dihentikan (process.exit(1))", async () => {
    const fakePool = {
      getConnection: jest
        .fn()
        .mockRejectedValue(
          mysqlError(
            "Unknown database 'pos_refactor_typo'",
            "ER_BAD_DB_ERROR",
            1049,
            "42000",
          ),
        ),
    };
    mysql.createPool.mockReturnValue(fakePool);
    process.env.DB_NAME = "pos_refactor_typo";

    await database.initializeDatabase();

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test("host/port benar tapi kredensial salah (ER_ACCESS_DENIED_ERROR) → tetap process.exit(1), bukan lanjut jalan diam-diam", async () => {
    const fakePool = {
      getConnection: jest
        .fn()
        .mockRejectedValue(
          mysqlError(
            "Access denied for user 'root'@'localhost'",
            "ER_ACCESS_DENIED_ERROR",
            1045,
            "28000",
          ),
        ),
    };
    mysql.createPool.mockReturnValue(fakePool);

    await database.initializeDatabase();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test("DB_NAME cocok & kredensial benar → TIDAK memanggil process.exit, koneksi dilepas kembali ke pool", async () => {
    const fakeConn = {
      query: jest.fn().mockResolvedValue([[{ version: "10.4.32-MariaDB" }]]),
      release: jest.fn(),
    };
    const fakePool = { getConnection: jest.fn().mockResolvedValue(fakeConn) };
    mysql.createPool.mockReturnValue(fakePool);
    process.env.DB_NAME = "pos_refactor";

    await database.initializeDatabase();

    expect(process.exit).not.toHaveBeenCalled();
    expect(fakeConn.release).toHaveBeenCalled();
  });
});

describe("query() / insert() / execute() — error skema diteruskan apa adanya, tidak ditelan (revisi dosen #20)", () => {
  let fakePool;
  let consoleErrorSpy;

  // Semua test di describe ini butuh `pool` sudah terisi lebih dulu (query/
  // insert/execute memanggil getPool() yang melempar error kalau pool masih
  // null) — jadi setiap beforeEach menjalankan initializeDatabase() dengan
  // koneksi sukses palsu dulu, BARU menguji fakePool.execute yang dipakai
  // query/insert/execute sesudahnya.
  beforeEach(async () => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "table").mockImplementation(() => {});
    jest.spyOn(console, "dir").mockImplementation(() => {});

    fakePool = {
      getConnection: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue([[{ version: "10.4.32-MariaDB" }]]),
        release: jest.fn(),
      }),
      execute: jest.fn(),
    };
    mysql.createPool.mockReturnValue(fakePool);

    await database.initializeDatabase();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("migrasi belum dijalankan: SELECT ke tabel yang belum dibuat → ER_NO_SUCH_TABLE diteruskan (bukan ditelan jadi undefined/[])", async () => {
    const err = mysqlError(
      "Table 'pos_refactor.cash_registers' doesn't exist",
      "ER_NO_SUCH_TABLE",
      1146,
      "42S02",
    );
    fakePool.execute.mockRejectedValueOnce(err);

    await expect(
      database.query("SELECT * FROM cash_registers WHERE is_active = 1"),
    ).rejects.toMatchObject({ code: "ER_NO_SUCH_TABLE", errno: 1146 });
    // Error harus tetap dilaporkan lewat logSqlError (console.error), supaya
    // muncul di log server — bukan cuma reject diam-diam.
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test("migrasi setengah jalan: kolom baru belum ada (ADD COLUMN belum di-run) → ER_BAD_FIELD_ERROR diteruskan", async () => {
    const err = mysqlError(
      "Unknown column 'register_id' in 'field list'",
      "ER_BAD_FIELD_ERROR",
      1054,
      "42S22",
    );
    fakePool.execute.mockRejectedValueOnce(err);

    await expect(
      database.insert("INSERT INTO cash_shifts (register_id) VALUES (?)", [1]),
    ).rejects.toMatchObject({ code: "ER_BAD_FIELD_ERROR", errno: 1054 });
  });

  test("ENUM salah: insert/update nilai di luar daftar ENUM kolom → ditolak (ER_TRUNCATED_WRONG_VALUE_FOR_FIELD) di mode strict, tidak lolos sebagai NULL/0 diam-diam", async () => {
    const err = mysqlError(
      "Data truncated for column 'status' at row 1",
      "WARN_DATA_TRUNCATED",
      1265,
      "01000",
    );
    fakePool.execute.mockRejectedValueOnce(err);

    await expect(
      database.execute(
        "UPDATE cash_shifts SET status = ? WHERE id = ?",
        ["dibatalkan", 10], // bukan 'open'/'closed' — di luar ENUM
      ),
    ).rejects.toMatchObject({ errno: 1265 });
  });

  test("FK salah (insert menunjuk induk yang tidak ada): register_id menunjuk baris cash_registers yang tidak ada → ER_NO_REFERENCED_ROW_2", async () => {
    const err = mysqlError(
      "Cannot add or update a child row: a foreign key constraint fails " +
        "(`pos_refactor`.`cash_shifts`, CONSTRAINT `fk_cash_shifts_register` " +
        "FOREIGN KEY (`register_id`) REFERENCES `cash_registers` (`id`))",
      "ER_NO_REFERENCED_ROW_2",
      1452,
      "23000",
    );
    fakePool.execute.mockRejectedValueOnce(err);

    await expect(
      database.insert(
        "INSERT INTO cash_shifts (shift_code, register_id) VALUES (?, ?)",
        ["KAS20260823", 999], // id 999 tidak ada di cash_registers
      ),
    ).rejects.toMatchObject({ code: "ER_NO_REFERENCED_ROW_2", errno: 1452 });
  });

  test("FK salah (hapus baris induk yang masih direferensikan): hapus cash_registers yang masih dipakai cash_shifts → ER_ROW_IS_REFERENCED_2", async () => {
    const err = mysqlError(
      "Cannot delete or update a parent row: a foreign key constraint fails",
      "ER_ROW_IS_REFERENCED_2",
      1451,
      "23000",
    );
    fakePool.execute.mockRejectedValueOnce(err);

    await expect(
      database.execute("DELETE FROM cash_registers WHERE id = ?", [1]),
    ).rejects.toMatchObject({ code: "ER_ROW_IS_REFERENCED_2", errno: 1451 });
  });

  test("queryOne() ikut melempar (bukan menelan jadi null) saat query() di bawahnya gagal karena error skema", async () => {
    const err = mysqlError(
      "Table 'pos_refactor.cash_registers' doesn't exist",
      "ER_NO_SUCH_TABLE",
      1146,
      "42S02",
    );
    fakePool.execute.mockRejectedValueOnce(err);

    await expect(
      database.queryOne("SELECT * FROM cash_registers WHERE is_active = 1"),
    ).rejects.toMatchObject({ code: "ER_NO_SUCH_TABLE" });
  });
});
