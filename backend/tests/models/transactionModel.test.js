// tests/models/transactionModel.test.js
// ─────────────────────────────────────────────────────────────────────────────
// UNIT TEST — logika base-unit / konversi satuan di transactionModel.js
// (revisi dosen #20). Tiga fungsi internal yang diuji langsung lewat
// `transactionModel._internal` (lihat ekspor tambahan di transactionModel.js):
//
//   resolveItemPrice(product, quantity, option)
//     Menentukan harga satuan yang dipakai: satuan dasar vs satuan tambahan
//     (mis. karung berisi 25kg) vs varian, termasuk aturan otomatis harga
//     grosir berdasarkan qty efektif (qty × conversionQty untuk unit).
//
//   normalizeOption(raw)
//     Sanitasi input dari klien — HANYA type & id yang boleh dipercaya
//     mentah dari body request; field harga/konversi klien tidak pernah
//     diambil di sini (itu tugas resolveVerifiedOption yang mengambil ulang
//     dari DB).
//
//   resolveVerifiedOption(option, product, conn)
//     Mengambil ulang data ASLI opsi (satuan/varian) dari database di dalam
//     transaction yang sama, dan menolak kombinasi yang tidak valid: opsi
//     tidak match dengan product_id (mencegah id opsi produk lain dipakai
//     lintas produk — setara FK salah di level app), faktor konversi <= 0
//     atau bukan angka, satuan purchase_only dijual, dan produk yang wajib
//     pilih varian/satuan tapi klien kirim "none".
//
// config/database & journalService di-mock (tidak dipakai langsung oleh
// helper-helper ini, tapi transactionModel me-require keduanya di top-level).
// ─────────────────────────────────────────────────────────────────────────────
jest.mock("../../config/database", () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  safeInt: jest.fn((v, fallback = 0) => Number(v) || fallback),
}));
jest.mock("../../services/journalService");

const { resolveItemPrice, normalizeOption, resolveVerifiedOption } =
  require("../../models/transactionModel")._internal;

describe("resolveItemPrice — satuan dasar (base unit)", () => {
  const product = {
    price: 10000,
    price_wholesale: 8000,
    min_qty_wholesale: 12,
  };

  test("qty di bawah ambang grosir → pakai harga eceran dasar", () => {
    const result = resolveItemPrice(product, 5, null);
    expect(result).toEqual({ unitPrice: 10000, priceType: "retail" });
  });

  test("qty tepat mencapai ambang grosir → otomatis pakai harga grosir dasar", () => {
    const result = resolveItemPrice(product, 12, null);
    expect(result).toEqual({ unitPrice: 8000, priceType: "wholesale" });
  });

  test("produk tanpa harga grosir (price_wholesale 0/null) → selalu eceran walau qty besar", () => {
    const noWholesale = {
      price: 5000,
      price_wholesale: null,
      min_qty_wholesale: null,
    };
    const result = resolveItemPrice(noWholesale, 999, null);
    expect(result).toEqual({ unitPrice: 5000, priceType: "retail" });
  });
});

describe("resolveItemPrice — satuan tambahan (unit option, mis. karung 25kg)", () => {
  const product = {
    price: 1000, // harga per kg (satuan dasar)
    price_wholesale: 900,
    min_qty_wholesale: 100, // grosir dasar mulai 100kg
  };

  test("unit tanpa harga sendiri → fallback harga dasar × conversionQty", () => {
    const option = {
      type: "unit",
      isBase: false,
      conversionQty: 25,
      price: null,
      priceWholesale: null,
      minQtyWholesale: null,
    };
    const result = resolveItemPrice(product, 1, option); // beli 1 karung = 25kg
    expect(result).toEqual({ unitPrice: 25000, priceType: "retail" }); // 1000 x 25
  });

  test("unit dengan harga sendiri → pakai harga unit itu, bukan hasil kali harga dasar", () => {
    const option = {
      type: "unit",
      isBase: false,
      conversionQty: 25,
      price: 24000, // harga karung didiskon, bukan 25000 murni
      priceWholesale: null,
      minQtyWholesale: null,
    };
    const result = resolveItemPrice(product, 1, option);
    expect(result).toEqual({ unitPrice: 24000, priceType: "retail" });
  });

  test("qty efektif (quantity x conversionQty) melewati ambang grosir DASAR → fallback grosir dasar x conversionQty walau unit tidak punya harga grosir sendiri", () => {
    const option = {
      type: "unit",
      isBase: false,
      conversionQty: 25,
      price: 25000,
      priceWholesale: null, // unit ini tidak punya harga grosir sendiri
      minQtyWholesale: null,
    };
    // 5 karung x 25kg = 125kg >= min_qty_wholesale dasar (100kg)
    const result = resolveItemPrice(product, 5, option);
    expect(result).toEqual({ unitPrice: 900 * 25, priceType: "wholesale" });
  });

  test("unit punya harga grosir sendiri & qty (bukan qty x conversion) capai ambang unit → pakai grosir unit itu sendiri", () => {
    const option = {
      type: "unit",
      isBase: false,
      conversionQty: 25,
      price: 25000,
      priceWholesale: 23000,
      minQtyWholesale: 3, // grosir unit mulai 3 karung
    };
    const result = resolveItemPrice(product, 3, option);
    expect(result).toEqual({ unitPrice: 23000, priceType: "wholesale" });
  });

  test("conversionQty tidak dikirim/invalid → default aman ke 1 (tidak crash / tidak NaN)", () => {
    const option = {
      type: "unit",
      isBase: false,
      conversionQty: undefined,
      price: 1500,
      priceWholesale: null,
      minQtyWholesale: null,
    };
    const result = resolveItemPrice(product, 2, option);
    expect(result).toEqual({ unitPrice: 1500, priceType: "retail" });
  });
});

describe("resolveItemPrice — varian", () => {
  test("qty di bawah ambang grosir varian → harga eceran varian", () => {
    const option = {
      type: "variant",
      price: 15000,
      priceWholesale: 13000,
      minQtyWholesale: 10,
    };
    const result = resolveItemPrice({}, 5, option);
    expect(result).toEqual({ unitPrice: 15000, priceType: "retail" });
  });

  test("qty capai ambang grosir varian → harga grosir varian", () => {
    const option = {
      type: "variant",
      price: 15000,
      priceWholesale: 13000,
      minQtyWholesale: 10,
    };
    const result = resolveItemPrice({}, 10, option);
    expect(result).toEqual({ unitPrice: 13000, priceType: "wholesale" });
  });
});

describe("normalizeOption — sanitasi input klien (tidak boleh percaya harga/konversi dari body)", () => {
  test("tanpa opsi / type 'none' → dianggap satuan dasar", () => {
    expect(normalizeOption(null)).toEqual({
      type: "none",
      id: null,
      label: null,
      isBase: true,
    });
    expect(normalizeOption({ type: "none" })).toEqual({
      type: "none",
      id: null,
      label: null,
      isBase: true,
    });
  });

  test("type 'unit' tanpa id → dianggap satuan dasar produk (isBase true)", () => {
    const result = normalizeOption({ type: "unit" });
    expect(result.isBase).toBe(true);
    expect(result.id).toBeNull();
  });

  test("type 'unit' dengan id → isBase false, id diteruskan sebagai angka", () => {
    const result = normalizeOption({ type: "unit", id: "7", label: "Karung" });
    expect(result).toEqual({
      type: "unit",
      id: 7,
      label: "Karung",
      isBase: false,
    });
  });

  test("type 'variant' → tidak pernah isBase, terlepas ada/tidaknya id", () => {
    expect(normalizeOption({ type: "variant", id: 3 }).isBase).toBe(false);
  });

  test("id bukan angka valid (mis. string acak) → diperlakukan sebagai null, bukan crash/NaN", () => {
    const result = normalizeOption({ type: "unit", id: "abc" });
    expect(result.id).toBeNull();
  });

  test("field harga/konversi kiriman klien (price, conversion_qty, dsb.) DIABAIKAN — tidak pernah muncul di hasil normalize", () => {
    const result = normalizeOption({
      type: "unit",
      id: 7,
      price: 1, // percobaan manipulasi harga
      conversion_qty: 0.001, // percobaan manipulasi faktor konversi
      isBase: true, // klaim isBase sendiri — tidak boleh dipercaya
    });
    expect(result).not.toHaveProperty("price");
    expect(result).not.toHaveProperty("conversion_qty");
    // isBase seharusnya dihitung dari (type unit + id ada) = false,
    // BUKAN dari klaim klien yang mengirim true.
    expect(result.isBase).toBe(false);
  });
});

describe("resolveVerifiedOption — verifikasi opsi terhadap DB (mencegah lintas produk / FK salah di level app)", () => {
  function makeConn(rows) {
    return { execute: jest.fn().mockResolvedValue([rows]) };
  }

  test("opsi 'none' untuk produk selection_type null → lolos, pakai satuan dasar produk", async () => {
    const product = { id: 1, name: "Beras", unit: "kg", selection_type: null };
    const conn = makeConn([]);
    const result = await resolveVerifiedOption(
      { type: "none", isBase: true },
      product,
      conn,
    );
    expect(result).toMatchObject({
      type: "none",
      isBase: true,
      conversionQty: 1,
    });
    expect(conn.execute).not.toHaveBeenCalled(); // tidak perlu query ke DB sama sekali
  });

  test("produk WAJIB pilih varian tapi klien kirim 'none' → ditolak", async () => {
    const product = { id: 1, name: "Kopi", selection_type: "variant" };
    const conn = makeConn([]);
    await expect(
      resolveVerifiedOption({ type: "none", isBase: true }, product, conn),
    ).rejects.toThrow(/wajib memilih varian/);
  });

  test("produk selection_type 'unit' & klien pilih satuan dasar eksplisit (isBase true) → tetap sah, bukan dianggap 'melewatkan pilihan'", async () => {
    const product = {
      id: 1,
      name: "Beras",
      unit: "kg",
      selection_type: "unit",
    };
    const conn = makeConn([]);
    const result = await resolveVerifiedOption(
      { type: "none", isBase: true },
      product,
      conn,
    );
    expect(result.isBase).toBe(true);
  });

  test("opsi 'unit' dikirim untuk produk selection_type 'variant' → ditolak (tipe opsi tidak cocok)", async () => {
    const product = { id: 1, name: "Kopi", selection_type: "variant" };
    const conn = makeConn([]);
    await expect(
      resolveVerifiedOption(
        { type: "unit", id: 5, isBase: false },
        product,
        conn,
      ),
    ).rejects.toThrow(/tidak menggunakan opsi satuan/);
  });

  test("id satuan valid tapi milik PRODUK LAIN (product_id tidak match) → ditolak, setara pelanggaran FK di level app", async () => {
    // Query di resolveVerifiedOption pakai WHERE pu.id = ? AND pu.product_id = ?
    // — kalau baris tidak ditemukan (karena product_id tidak cocok), rows
    // kosong. Ini yang mencegah klien memakai id satuan produk lain untuk
    // "mencuri" konversi/harga produk tersebut demi produk target yang lebih
    // mahal (celah yang disebutkan di komentar sumber sebagai price tampering).
    const product = { id: 1, name: "Beras", selection_type: "unit" };
    const conn = makeConn([]); // simulasikan: tidak ada baris product_units yang match
    await expect(
      resolveVerifiedOption(
        { type: "unit", id: 999, isBase: false },
        product,
        conn,
      ),
    ).rejects.toThrow(/tidak ditemukan\/tidak sesuai/);
  });

  test("satuan purchase_only tidak boleh dipakai untuk transaksi jual", async () => {
    const product = { id: 1, name: "Beras", selection_type: "unit" };
    const conn = makeConn([
      {
        id: 7,
        conversion_qty: 25,
        price: null,
        price_wholesale: null,
        min_qty_wholesale: null,
        purchase_only: 1,
        unit_name: "Karung",
      },
    ]);
    await expect(
      resolveVerifiedOption(
        { type: "unit", id: 7, isBase: false },
        product,
        conn,
      ),
    ).rejects.toThrow(/hanya untuk pembelian/);
  });

  test("conversion_qty di DB rusak/0/negatif (data migrasi/ENUM salah) → ditolak, bukan dipakai sebagai pengali 0", async () => {
    const product = { id: 1, name: "Beras", selection_type: "unit" };
    const conn = makeConn([
      {
        id: 7,
        conversion_qty: 0, // data korup / migrasi lama tidak lengkap
        price: 25000,
        price_wholesale: null,
        min_qty_wholesale: null,
        purchase_only: 0,
        unit_name: "Karung",
      },
    ]);
    await expect(
      resolveVerifiedOption(
        { type: "unit", id: 7, isBase: false },
        product,
        conn,
      ),
    ).rejects.toThrow(/[Ff]aktor konversi.*tidak valid/);
  });

  test("satuan valid & aktif → mengembalikan data ASLI dari DB (bukan dari input klien)", async () => {
    const product = { id: 1, name: "Beras", selection_type: "unit" };
    const conn = makeConn([
      {
        id: 7,
        conversion_qty: 25,
        price: 24000,
        price_wholesale: 22000,
        min_qty_wholesale: 3,
        purchase_only: 0,
        unit_name: "Karung",
      },
    ]);
    const result = await resolveVerifiedOption(
      { type: "unit", id: 7, isBase: false },
      product,
      conn,
    );
    expect(result).toEqual({
      type: "unit",
      id: 7,
      label: "Karung",
      conversionQty: 25,
      isBase: false,
      price: 24000,
      priceWholesale: 22000,
      minQtyWholesale: 3,
    });
    // Query harus benar-benar membatasi ke product_id target (id 1) — inilah
    // pengecekan "FK app-level" yang mencegah opsi lintas produk.
    const [, params] = conn.execute.mock.calls[0];
    expect(params).toEqual([7, 1]);
  });

  test("id varian valid tapi milik produk lain → ditolak dengan cara sama seperti opsi unit", async () => {
    const product = { id: 1, name: "Kopi", selection_type: "variant" };
    const conn = makeConn([]); // product_id tidak match → rows kosong
    await expect(
      resolveVerifiedOption(
        { type: "variant", id: 42, isBase: false },
        product,
        conn,
      ),
    ).rejects.toThrow(/[Vv]arian tidak ditemukan\/tidak sesuai/);
  });
});
