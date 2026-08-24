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
jest.mock("../../services/accountingService");

const journalModel = require("../../models/journalModel");
const journalService = require("../../services/journalService");
const accountingService = require("../../services/accountingService");
const {
  ValidationError,
  NotFoundError,
} = require("../../services/productService");

// Peta kode akun → id akun palsu, dipakai findAccountByCode agar
// accountIdByCode() di journalService bisa "menemukan" akun tanpa DB.
const ACCOUNT_ID_BY_CODE = {
  1100: 1, // Kas
  1150: 2, // Bank
  1200: 3, // Persediaan
  1300: 4, // Piutang Usaha
  2100: 5, // Utang Usaha
  4100: 6, // Penjualan
  4200: 7, // Diskon Penjualan
  5100: 8, // HPP
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
        lines: [{ debit: 100 }, { account_code: "4100", credit: 100 }],
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

describe("journalService.postExpenseJournal (biaya operasional + auto-settle akrual)", () => {
  const baseExpense = {
    id: 501,
    expense_date: "2026-08-19",
    category: "gaji",
    description: "Gaji karyawan Agustus",
    amount: 500000,
    recorded_by: "Admin",
  };

  beforeEach(() => {
    // 2110 Utang Gaji, 5220 Beban Gaji, 5210 Beban Sewa — tambahan dari peta akun dasar
    journalModel.findAccountByCode.mockImplementation(async (code) => {
      const map = { ...ACCOUNT_ID_BY_CODE, 2110: 10, 5220: 11, 5210: 12 };
      const id = map[code];
      return id
        ? { id, account_code: code, account_name: `Akun ${code}` }
        : null;
    });
  });

  test("tanpa saldo Utang Gaji outstanding: seluruhnya Dr Beban Gaji, Cr Kas (perilaku lama)", async () => {
    journalModel.accountBalance.mockResolvedValue({
      total_debit: 0,
      total_credit: 0,
    });
    // conn={} (truthy, sama seperti test postSaleJournal lain) supaya
    // postEntry tidak lanjut memanggil getEntryDetail (yang butuh DB asli).
    await journalService.postExpenseJournal(baseExpense, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    expect(callArg.lines).toEqual([
      expect.objectContaining({ account_id: 11, debit: 500000, credit: 0 }),
      expect.objectContaining({ account_id: 1, debit: 0, credit: 500000 }),
    ]);
  });

  test("ada saldo Utang Gaji outstanding (akrual belum dibalik): melunasi Utang dulu, TIDAK dobel ke Beban", async () => {
    // Akun 2110 (Utang Gaji) punya saldo kredit 500000 (dari akrual periode
    // lalu yang belum/lupa dibalik) — persis skenario "-Rp200.000" dosen.
    journalModel.accountBalance.mockResolvedValue({
      total_debit: 0,
      total_credit: 500000,
    });
    await journalService.postExpenseJournal(baseExpense, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    // Seluruh 500000 melunasi Utang Gaji (akun 10) — TIDAK ada baris ke akun
    // Beban Gaji (11) sama sekali, karena pembayaran ini murni pelunasan.
    expect(callArg.lines).toEqual([
      expect.objectContaining({ account_id: 10, debit: 500000, credit: 0 }),
      expect.objectContaining({ account_id: 1, debit: 0, credit: 500000 }),
    ]);
    const bebanLine = callArg.lines.find((l) => l.account_id === 11);
    expect(bebanLine).toBeUndefined();
    const totalDebit = callArg.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = callArg.lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  test("saldo Utang Gaji outstanding lebih kecil dari nominal bayar: split — sebagian lunasi Utang, sisanya Beban baru", async () => {
    // Diakrualkan 300000, tapi gaji yang dibayar bulan ini 500000 (ada
    // kenaikan/lembur) → 300000 melunasi Utang, 200000 sisanya Beban baru.
    journalModel.accountBalance.mockResolvedValue({
      total_debit: 0,
      total_credit: 300000,
    });
    await journalService.postExpenseJournal(baseExpense, {});
    const callArg = journalModel.createEntry.mock.calls[0][0];
    const utangLine = callArg.lines.find((l) => l.account_id === 10);
    const bebanLine = callArg.lines.find((l) => l.account_id === 11);
    expect(utangLine.debit).toBe(300000);
    expect(bebanLine.debit).toBe(200000);
    const totalDebit = callArg.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = callArg.lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  test("kategori tanpa akun akrual (mis. sewa): tidak mengecek akun Utang sama sekali", async () => {
    await journalService.postExpenseJournal(
      { ...baseExpense, category: "sewa" },
      {},
    );
    expect(journalModel.accountBalance).not.toHaveBeenCalled();
  });
});

describe("journalService.postVoidExpenseJournal (pembalikan biaya operasional)", () => {
  test("membalik PERSIS baris jurnal asli (bukan rekonstruksi dari kategori) — termasuk kasus split Utang+Beban", async () => {
    const expense = {
      id: 501,
      expense_date: "2026-08-19",
      category: "gaji",
      description: "Gaji karyawan Agustus",
      amount: 500000,
      recorded_by: "Admin",
    };
    journalModel.findLatestEntryByReference.mockResolvedValue({ id: 777 });
    journalModel.findLinesByEntryId.mockResolvedValue([
      {
        account_id: 10,
        debit: 300000,
        credit: 0,
        description: "Pelunasan Utang Gaji",
      },
      {
        account_id: 11,
        debit: 200000,
        credit: 0,
        description: "Gaji karyawan Agustus",
      },
      {
        account_id: 1,
        debit: 0,
        credit: 500000,
        description: "Gaji karyawan Agustus",
      },
    ]);

    await journalService.postVoidExpenseJournal(expense, {});

    const callArg = journalModel.createEntry.mock.calls[0][0];
    expect(callArg.reversalOfId).toBe(777);
    expect(callArg.reference_type ?? callArg.referenceType).toBe(
      "expense_void",
    );
    // Debit/kredit persis ditukar dari baris asli
    expect(callArg.lines).toEqual([
      expect.objectContaining({ account_id: 10, debit: 0, credit: 300000 }),
      expect.objectContaining({ account_id: 11, debit: 0, credit: 200000 }),
      expect.objectContaining({ account_id: 1, debit: 500000, credit: 0 }),
    ]);
    const totalDebit = callArg.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = callArg.lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });
});

describe("journalService.getCashAndBankBalances (saldo Kas & Bank untuk tampilan FE)", () => {
  test("mengembalikan saldo Kas & Bank berdasarkan mutasi masing-masing akun", async () => {
    journalModel.findAccountByCode.mockImplementation(async (code) => {
      if (code === "1100")
        return { id: 1, account_code: "1100", normal_balance: "debit" };
      if (code === "1150")
        return { id: 2, account_code: "1150", normal_balance: "debit" };
      return null;
    });
    journalModel.accountOpeningBalance.mockImplementation(async (accountId) => {
      if (accountId === 1)
        return { total_debit: 5000000, total_credit: 1200000 };
      if (accountId === 2)
        return { total_debit: 3000000, total_credit: 500000 };
      return { total_debit: 0, total_credit: 0 };
    });

    const result = await journalService.getCashAndBankBalances();

    expect(result).toEqual({ kas: 3800000, bank: 2500000 });
  });

  test("mengembalikan 0 kalau akun Kas/Bank belum ada di Chart of Accounts", async () => {
    journalModel.findAccountByCode.mockResolvedValue(null);

    const result = await journalService.getCashAndBankBalances();

    expect(result).toEqual({ kas: 0, bank: 0 });
  });
});

describe("journalService.systemValidation (poin 10 revisi dosen — cross-check laporan)", () => {
  // Skenario sengaja dibuat SEDERHANA & KONSISTEN: Kas+Bank 1.300.000,
  // Utang Usaha 300.000, Modal Pemilik 1.000.000 (Aset = Kewajiban+Modal),
  // tanpa akun Pendapatan/Beban (Laba Berjalan = 0) — supaya gampang
  // dihitung ulang manual di assertion.
  const mockRows = [
    {
      id: 1,
      account_code: "1100",
      account_name: "Kas",
      account_type: "aset",
      normal_balance: "debit",
      total_debit: 1000000,
      total_credit: 200000,
    },
    {
      id: 2,
      account_code: "1150",
      account_name: "Bank",
      account_type: "aset",
      normal_balance: "debit",
      total_debit: 500000,
      total_credit: 0,
    },
    {
      id: 5,
      account_code: "2100",
      account_name: "Utang Usaha",
      account_type: "kewajiban",
      normal_balance: "kredit",
      total_debit: 0,
      total_credit: 300000,
    },
    {
      id: 9,
      account_code: "3100",
      account_name: "Modal Pemilik",
      account_type: "modal",
      normal_balance: "kredit",
      total_debit: 0,
      total_credit: 1000000,
    },
  ];

  beforeEach(() => {
    journalModel.trialBalanceRows.mockResolvedValue(mockRows);
    journalModel.cashOpeningBalance.mockResolvedValue({
      total_debit: 0,
      total_credit: 0,
    });
    journalModel.cashMovementsByReferenceType.mockResolvedValue([
      { reference_type: "capital", total_debit: 1300000, total_credit: 0 },
    ]);
  });

  test("semua laporan saling cocok → is_valid true, kelima check individual juga valid", async () => {
    accountingService.incomeStatement.mockResolvedValue({
      profit_before_tax: 0,
    });

    const result = await journalService.systemValidation({
      as_of_date: "2026-08-19",
    });

    expect(result.is_valid).toBe(true);
    // 4 check lintas laporan (poin 10) + 1 check saldo abnormal (poin 6).
    expect(result.checks).toHaveLength(5);
    result.checks.forEach((c) => expect(c.is_valid).toBe(true));

    const saldoAbnormal = result.checks.find((c) => c.id === "saldo_abnormal");
    expect(saldoAbnormal.left).toBe(0);
    expect(saldoAbnormal.is_valid).toBe(true);

    const debitKredit = result.checks.find((c) => c.id === "debit_kredit");
    expect(debitKredit.left).toBe(1500000);
    expect(debitKredit.right).toBe(1500000);

    const asetCheck = result.checks.find(
      (c) => c.id === "aset_kewajiban_modal",
    );
    expect(asetCheck.left).toBe(1300000);
    expect(asetCheck.right).toBe(1300000);

    const kasCheck = result.checks.find((c) => c.id === "kas_arus_kas_neraca");
    expect(kasCheck.left).toBe(1300000); // saldo akhir Arus Kas
    expect(kasCheck.right).toBe(1300000); // Kas+Bank di Neraca
  });

  test("Laba Rugi (Laba Sebelum Pajak) tidak cocok dengan Laba Berjalan Neraca → check itu Tidak Valid, is_valid keseluruhan false", async () => {
    // Income statement bilang untung 500.000, padahal akun Pendapatan/Beban
    // di jurnal (dipakai Neraca) menunjukkan Laba Berjalan = 0 — mismatch
    // yang harus ketahuan lewat Validasi Sistem.
    accountingService.incomeStatement.mockResolvedValue({
      profit_before_tax: 500000,
    });

    const result = await journalService.systemValidation({
      as_of_date: "2026-08-19",
    });

    expect(result.is_valid).toBe(false);
    const labaCheck = result.checks.find(
      (c) => c.id === "laba_rugi_laba_berjalan",
    );
    expect(labaCheck.is_valid).toBe(false);
    expect(labaCheck.selisih).toBe(500000);
    // Check lain yang tidak terpengaruh tetap valid
    expect(result.checks.find((c) => c.id === "debit_kredit").is_valid).toBe(
      true,
    );
    expect(
      result.checks.find((c) => c.id === "aset_kewajiban_modal").is_valid,
    ).toBe(true);
    expect(
      result.checks.find((c) => c.id === "kas_arus_kas_neraca").is_valid,
    ).toBe(true);
  });

  test("saldo Kas Arus Kas tidak cocok dengan Kas Neraca → check kas Tidak Valid", async () => {
    accountingService.incomeStatement.mockResolvedValue({
      profit_before_tax: 0,
    });
    journalModel.cashMovementsByReferenceType.mockResolvedValue([
      { reference_type: "capital", total_debit: 1000000, total_credit: 0 }, // seharusnya 1.300.000
    ]);

    const result = await journalService.systemValidation({
      as_of_date: "2026-08-19",
    });

    expect(result.is_valid).toBe(false);
    const kasCheck = result.checks.find((c) => c.id === "kas_arus_kas_neraca");
    expect(kasCheck.is_valid).toBe(false);
    expect(kasCheck.left).toBe(1000000);
    expect(kasCheck.right).toBe(1300000);
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
    journalModel.findAccountByCode.mockResolvedValueOnce({
      id: 1,
      account_code: "1100",
    });
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
    await expect(journalService.updateAccount(1, {})).rejects.toThrow(
      NotFoundError,
    );
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
      .mockResolvedValueOnce({
        id: 1,
        account_code: "1100",
        account_name: "Kas Toko",
      });
    const result = await journalService.updateAccount(1, {
      account_name: "Kas Toko",
    });
    expect(journalModel.updateAccount).toHaveBeenCalledTimes(1);
    expect(result.account_name).toBe("Kas Toko");
  });
});

describe("journalService.trialBalance — validasi saldo abnormal (poin 6 revisi dosen)", () => {
  test("akun normal (Kas bersaldo debit, Utang bersaldo kredit): tidak ada yang ditandai abnormal", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 1,
        account_code: "1100",
        account_name: "Kas",
        account_type: "aset",
        normal_balance: "debit",
        total_debit: 1000000,
        total_credit: 300000,
      },
      {
        id: 5,
        account_code: "2100",
        account_name: "Utang Usaha",
        account_type: "kewajiban",
        normal_balance: "kredit",
        total_debit: 100000,
        total_credit: 400000,
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    expect(result.summary.has_saldo_abnormal).toBe(false);
    expect(result.summary.jumlah_akun_abnormal).toBe(0);
    result.accounts.forEach((a) => expect(a.is_abnormal).toBe(false));
  });

  test("Kas bersaldo kredit (minus) karena salah jurnal: ditandai abnormal", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 1,
        account_code: "1100",
        account_name: "Kas",
        account_type: "aset",
        normal_balance: "debit",
        total_debit: 100000,
        total_credit: 500000, // lebih banyak dikredit daripada didebit → minus
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    const kas = result.accounts.find((a) => a.account_code === "1100");
    expect(kas.is_abnormal).toBe(true);
    expect(kas.abnormal_note).toMatch(/Kas/);
    expect(result.summary.has_saldo_abnormal).toBe(true);
    expect(result.summary.jumlah_akun_abnormal).toBe(1);
    expect(result.summary.akun_abnormal[0].account_code).toBe("1100");
  });

  test("Utang Gaji bersaldo debit (kelebihan bayar / overpaid): ditandai abnormal — kasus asli 'Utang Gaji -Rp200.000' dari dosen", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 10,
        account_code: "2110",
        account_name: "Utang Gaji",
        account_type: "kewajiban",
        normal_balance: "kredit",
        total_debit: 700000,
        total_credit: 500000, // dibayar lebih besar dari yang diakrualkan
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    const utangGaji = result.accounts.find((a) => a.account_code === "2110");
    expect(utangGaji.is_abnormal).toBe(true);
    expect(utangGaji.balance).toBe(-200000);
  });

  test("Prive (akun kontra-Modal, normal_balance DB = 'kredit') SELALU didebit — TIDAK boleh ditandai abnormal meski balance mentahnya negatif", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 20,
        account_code: "3200",
        account_name: "Prive / Laba Ditahan",
        account_type: "modal",
        normal_balance: "kredit", // sesuai seed DB (lihat komentar EXPECTED_BALANCE_SIDE_OVERRIDE)
        total_debit: 500000, // penarikan modal — selalu didebit
        total_credit: 0,
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    const prive = result.accounts.find((a) => a.account_code === "3200");
    expect(prive.is_abnormal).toBe(false);
    expect(result.summary.has_saldo_abnormal).toBe(false);
  });

  test("Prive dikredit (seharusnya tidak pernah terjadi): TETAP ditandai abnormal", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 20,
        account_code: "3200",
        account_name: "Prive / Laba Ditahan",
        account_type: "modal",
        normal_balance: "kredit",
        total_debit: 0,
        total_credit: 200000,
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    const prive = result.accounts.find((a) => a.account_code === "3200");
    expect(prive.is_abnormal).toBe(true);
  });

  test("Saldo Awal/Penyesuaian (3300, akun penampung 2 arah) dikecualikan dari validasi meski saldo negatif", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 30,
        account_code: "3300",
        account_name: "Saldo Awal / Penyesuaian",
        account_type: "modal",
        normal_balance: "kredit",
        total_debit: 500000, // lebih banyak dipakai untuk Hutang manual (debit)
        total_credit: 100000,
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    const saldoAwal = result.accounts.find((a) => a.account_code === "3300");
    expect(saldoAwal.is_abnormal).toBe(false);
  });

  test("akun tanpa aktivitas sama sekali (total_debit=0, total_credit=0): tidak ditandai abnormal", async () => {
    journalModel.trialBalanceRows.mockResolvedValue([
      {
        id: 40,
        account_code: "5280",
        account_name: "Beban Operasional Lainnya",
        account_type: "beban",
        normal_balance: "debit",
        total_debit: 0,
        total_credit: 0,
      },
    ]);

    const result = await journalService.trialBalance({
      as_of_date: "2026-08-21",
    });

    expect(result.accounts[0].is_abnormal).toBe(false);
  });
});
