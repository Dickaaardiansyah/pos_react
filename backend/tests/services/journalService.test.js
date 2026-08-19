// tests/services/journalService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — journalService (engine inti double-entry & posting otomatis)
//
// journalModel di-mock total (jest.mock) supaya test ini murni menguji
// LOGIKA BISNIS di service layer (validasi balance, negatif, dsb), tanpa
// menyentuh database sungguhan. Ini konsisten dengan arsitektur MVC proyek:
// Model = akses data, Service = aturan bisnis → yang diuji di sini adalah
// Service saja (unit test), bukan integrasi ke MySQL.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../models/journalModel");

const journalModel = require("../../models/journalModel");
const journalService = require("../../services/journalService");
const { ValidationError, NotFoundError } = require("../../services/productService");

// Peta kode akun → id akun palsu, dipakai findAccountByCode agar
// accountIdByCode() di journalService bisa "menemukan" akun tanpa DB.
const ACCOUNT_ID_BY_CODE = {
  "1100": 1, // Kas
  "1150": 2, // Bank
  "1200": 3, // Persediaan
  "1300": 4, // Piutang Usaha
  "2100": 5, // Utang Usaha
  "4100": 6, // Penjualan
  "4200": 7, // Diskon Penjualan
  "5100": 8, // HPP
};

beforeEach(() => {
  jest.clearAllMocks();
  journalModel.findAccountByCode.mockImplementation(async (code) => {
    const id = ACCOUNT_ID_BY_CODE[code];
    return id ? { id, account_code: code } : null;
  });
  journalModel.createEntry.mockImplementation(async ({ entryCode }) => ({
    id: 999,
    entryCode,
  }));
});

describe("journalService.postEntry (engine inti double-entry)", () => {
  test("menolak jurnal dengan kurang dari 2 baris", async () => {
    await expect(
      journalService.postEntry({
        lines: [{ account_code: "1100", debit: 100 }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak baris jurnal tanpa akun (account_id/account_code kosong)", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { debit: 100 },
          { account_code: "4100", credit: 100 },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak nilai debit negatif", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "1100", debit: -50 },
          { account_code: "4100", credit: 50 },
        ],
      }),
    ).rejects.toThrow("tidak boleh bernilai negatif");
  });

  test("menolak nilai kredit negatif", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "1100", debit: 50 },
          { account_code: "4100", credit: -50 },
        ],
      }),
    ).rejects.toThrow("tidak boleh bernilai negatif");
  });

  test("menolak satu baris yang mengisi debit dan kredit sekaligus", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "1100", debit: 50, credit: 50 },
          { account_code: "4100", credit: 50 },
        ],
      }),
    ).rejects.toThrow("tidak boleh mengisi debit dan kredit sekaligus");
  });

  test("menolak jurnal yang tidak balance (total debit ≠ total kredit)", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "1100", debit: 100 },
          { account_code: "4100", credit: 90 },
        ],
      }),
    ).rejects.toThrow(/tidak balance/);
  });

  test("menolak jurnal bernilai nol (semua baris kosong/0)", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "1100", debit: 0 },
          { account_code: "4100", credit: 0 },
        ],
      }),
    ).rejects.toThrow("tidak boleh bernilai nol");
  });

  test("melempar error kalau kode akun sistem tidak ditemukan di DB", async () => {
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "9999", debit: 100 },
          { account_code: "4100", credit: 100 },
        ],
      }),
    ).rejects.toThrow(/Akun sistem dengan kode 9999 tidak ditemukan/);
  });

  test("berhasil posting jurnal balance dan meneruskan baris yang sudah diresolve ke model", async () => {
    const result = await journalService.postEntry({
      entryDate: "2026-08-19",
      description: "Test transaksi",
      referenceType: "manual",
      source: "manual",
      lines: [
        { account_code: "1100", debit: 100000 },
        { account_code: "4100", credit: 100000 },
      ],
      conn: {}, // simulasikan dipanggil di dalam DB transaction pemanggil
    });

    expect(journalModel.createEntry).toHaveBeenCalledTimes(1);
    const callArg = journalModel.createEntry.mock.calls[0][0];
    expect(callArg.lines).toEqual([
      expect.objectContaining({ account_id: 1, debit: 100000, credit: 0 }),
      expect.objectContaining({ account_id: 6, debit: 0, credit: 100000 }),
    ]);
    expect(result.id).toBe(999);
  });

  test("baris dengan debit dan kredit sama-sama 0 dilewati (tidak dikirim ke model)", async () => {
    await journalService.postEntry({
      lines: [
        { account_code: "1100", debit: 100 },
        { account_code: "1150", debit: 0, credit: 0 }, // baris kosong, harus diskip
        { account_code: "4100", credit: 100 },
      ],
      conn: {},
    });
    const callArg = journalModel.createEntry.mock.calls[0][0];
    expect(callArg.lines).toHaveLength(2);
  });

  test("nilai dibulatkan ke 2 desimal (round2) sebelum dicek balance", async () => {
    // 100.004 dibulatkan jadi 100 oleh round2(), sehingga sama dengan 100 —
    // membuktikan pembulatan diterapkan SEBELUM validasi balance, bukan sesudah.
    await expect(
      journalService.postEntry({
        lines: [
          { account_code: "1100", debit: 100.004 },
          { account_code: "4100", credit: 100 },
        ],
        conn: {},
      }),
    ).resolves.toBeDefined();
  });
});

describe("journalService.postSaleJournal (posting otomatis penjualan)", () => {
  const baseTx = {
    id: 1,
    transaction_code: "TSR2026081900011",
    payment_method: "cash",
    final_amount: 100000,
    total_amount: 100000,
    discount_amount: 0,
    cashier_name: "Kasir A",
    created_at: "2026-08-19 10:00:00",
    items: [{ unit_cost: 5000, quantity: 4 }], // total cost 20000
  };

  test("penjualan tunai: jurnal balance (Kas & HPP/Persediaan ikut terposting)", async () => {
    await journalService.postSaleJournal(baseTx, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    const totalDebit = callArg.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = callArg.lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
    // Kas didebit sebesar final_amount
    expect(callArg.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ account_id: 1, debit: 100000 }),
      ]),
    );
  });

  test("open bill dengan DP sebagian: jurnal tetap balance (Kas + Piutang = final_amount)", async () => {
    const tx = {
      ...baseTx,
      payment_method: "open_bill",
      payment_amount: 40000,
      final_amount: 100000,
    };
    await journalService.postSaleJournal(tx, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    const kasLine = callArg.lines.find((l) => l.account_id === 1);
    const piutangLine = callArg.lines.find((l) => l.account_id === 4);
    expect(kasLine.debit).toBe(40000);
    expect(piutangLine.debit).toBe(60000);
    const totalDebit = callArg.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = callArg.lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  test("open bill penuh tanpa DP (payment_amount 0): seluruhnya jadi Piutang, tanpa baris Kas", async () => {
    const tx = {
      ...baseTx,
      payment_method: "open_bill",
      payment_amount: 0,
      final_amount: 100000,
    };
    await journalService.postSaleJournal(tx, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    const kasLine = callArg.lines.find((l) => l.account_id === 1);
    const piutangLine = callArg.lines.find((l) => l.account_id === 4);
    expect(kasLine).toBeUndefined();
    expect(piutangLine.debit).toBe(100000);
  });

  test("penjualan dengan diskon: baris Diskon Penjualan ikut ditambahkan dan tetap balance", async () => {
    const tx = { ...baseTx, discount_amount: 5000, final_amount: 95000 };
    await journalService.postSaleJournal(tx, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    const diskonLine = callArg.lines.find((l) => l.account_id === 7);
    expect(diskonLine.debit).toBe(5000);
    const totalDebit = callArg.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = callArg.lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });
});

describe("journalService.createAccount (validasi Chart of Accounts)", () => {
  test("menolak jika field wajib kosong", async () => {
    await expect(
      journalService.createAccount({ account_code: "9000" }),
    ).rejects.toThrow(ValidationError);
  });

  test("menolak account_type yang tidak dikenal", async () => {
    await expect(
      journalService.createAccount({
        account_code: "9000",
        account_name: "Akun Aneh",
        account_type: "tidak_valid",
        normal_balance: "debit",
      }),
    ).rejects.toThrow("Tipe akun tidak valid");
  });

  test("menolak normal_balance selain debit/kredit", async () => {
    await expect(
      journalService.createAccount({
        account_code: "9000",
        account_name: "Akun Aneh",
        account_type: "aset",
        normal_balance: "netral",
      }),
    ).rejects.toThrow("Saldo normal harus 'debit' atau 'kredit'");
  });

  test("menolak kode akun yang sudah dipakai", async () => {
    journalModel.findAccountByCode.mockResolvedValueOnce({ id: 1, account_code: "1100" });
    await expect(
      journalService.createAccount({
        account_code: "1100",
        account_name: "Kas Duplikat",
        account_type: "aset",
        normal_balance: "debit",
      }),
    ).rejects.toThrow("Kode akun sudah digunakan");
  });

  test("berhasil membuat akun baru dengan data valid", async () => {
    journalModel.findAccountByCode.mockResolvedValueOnce(null);
    journalModel.createAccount.mockResolvedValueOnce({ insertId: 50 });
    journalModel.findAccountById.mockResolvedValueOnce({
      id: 50,
      account_code: "9000",
      account_name: "Akun Baru",
    });

    const result = await journalService.createAccount({
      account_code: "9000",
      account_name: "Akun Baru",
      account_type: "aset",
      normal_balance: "debit",
    });
    expect(result.id).toBe(50);
    expect(journalModel.createAccount).toHaveBeenCalledTimes(1);
  });
});

describe("journalService.updateAccount (proteksi akun sistem)", () => {
  test("melempar NotFoundError jika akun tidak ada", async () => {
    journalModel.findAccountById.mockResolvedValueOnce(null);
    await expect(journalService.updateAccount(1, {})).rejects.toThrow(NotFoundError);
  });

  test("menolak menonaktifkan akun sistem (is_system = true)", async () => {
    journalModel.findAccountById.mockResolvedValueOnce({
      id: 1,
      account_code: "1100",
      is_system: true,
    });
    await expect(
      journalService.updateAccount(1, { is_active: false }),
    ).rejects.toThrow("Akun sistem tidak dapat dinonaktifkan");
  });

  test("mengizinkan update nama/deskripsi akun sistem selama tidak menonaktifkan", async () => {
    journalModel.findAccountById
      .mockResolvedValueOnce({ id: 1, account_code: "1100", is_system: true })
      .mockResolvedValueOnce({ id: 1, account_code: "1100", account_name: "Kas Toko" });
    const result = await journalService.updateAccount(1, {
      account_name: "Kas Toko",
    });
    expect(journalModel.updateAccount).toHaveBeenCalledTimes(1);
    expect(result.account_name).toBe("Kas Toko");
  });
});
