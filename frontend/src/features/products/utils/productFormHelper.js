// src/features/products/utils/productFormHelper.js
//
// Kumpulan helper murni (tanpa JSX) untuk form Produk: baris satuan/varian
// kosong, kalkulasi untung per satuan, dan generator barcode. Sebelumnya
// logic ini terduplikasi di ProductsPage.jsx, ProductFormFields.jsx (file
// mati, tidak pernah diimpor), dan hooks.js — sekarang jadi satu sumber.

export function emptyUnitRow() {
  return {
    unit_id: null,
    unit_name: "",
    conversion_qty: "",
    price: "",
    price_wholesale: "",
    min_qty_wholesale: "",
    purchase_only: false,
  };
}

export function emptyVariantRow() {
  return {
    name: "",
    price: "",
    price_wholesale: "",
    min_qty_wholesale: "",
    barcode: "",
  };
}

export function generateBarcodeCode() {
  const ts = Math.floor(Date.now() / 100)
    .toString()
    .slice(-10);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `889${ts}${rand}`;
}

// Pilihan cepat untuk kolom nilai konversi (mis. "= 0,5 kg") — dropdown murni
// tanpa isi manual, supaya user awam tidak perlu tahu bentuk desimal dari
// pecahan seperti ¼ atau ½. Mencakup pecahan satuan dasar (jual eceran lebih
// kecil, mis. ½ kg) sampai kelipatan umum (jual dalam kemasan besar, mis.
// Karung = 25 kg).
export const CONVERSION_QTY_OPTIONS = [
  { label: "¼", value: 0.25 },
  { label: "½", value: 0.5 },
  { label: "¾", value: 0.75 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "8", value: 8 },
  { label: "10", value: 10 },
  { label: "12", value: 12 },
  { label: "15", value: 15 },
  { label: "20", value: 20 },
  { label: "24", value: 24 },
  { label: "25", value: 25 },
  { label: "30", value: 30 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
];

// Satuan dasar (Harga & Satuan) dan satuan yang sudah dipakai di baris lain
// tidak boleh muncul lagi di dropdown "Cari/Pilih..." baris ini — supaya
// user tidak bisa pilih satuan yang sama dua kali (sebelumnya bug: "kg"
// yang sudah jadi satuan dasar masih muncul lagi di daftar pilihan).
export function getAvailableUnitsForRow(units, form, currentIndex) {
  const taken = new Set(
    [
      form.unit,
      ...form.additional_units
        .filter((_, i) => i !== currentIndex)
        .map((r) => r.unit_name),
    ]
      .filter(Boolean)
      .map((n) => n.trim().toLowerCase()),
  );
  return units.filter((u) => !taken.has((u.name || "").trim().toLowerCase()));
}

// Bandingkan potensi untung kalau 1 batch pembelian (mis. 1 Karung = 25 kg)
// dijual habis lewat masing-masing satuan yang tersedia — supaya kelihatan
// satuan mana yang marginnya paling tebal (mis. dipecah jadi ¼ kg biasanya
// untungnya lebih besar daripada dijual utuh per Karung). Batch acuannya
// otomatis dari baris satuan tambahan dengan nilai konversi TERBESAR (biasanya
// itu satuan beli/kemasan besarnya, mis. Karung=25 dibanding 1/2 kg=0,5).
export function buildUnitProfitSummary(form) {
  const validRows = form.additional_units.filter(
    (r) => r.unit_id && Number(r.conversion_qty) > 0,
  );
  if (validRows.length === 0) return null;

  const referenceRow = validRows.reduce(
    (max, r) => (Number(r.conversion_qty) > Number(max.conversion_qty) ? r : max),
    validRows[0],
  );
  const totalQty = Number(referenceRow.conversion_qty);
  const baseCost = Number(form.cost_price);
  if (!(baseCost > 0) || !(totalQty > 0)) return null;

  const totalModal = baseCost * totalQty;

  const sellableUnits = [
    { name: form.unit || "satuan dasar", conversionQty: 1, price: Number(form.price) },
    ...validRows.map((r) => ({
      name: r.unit_name,
      conversionQty: Number(r.conversion_qty),
      price: Number(r.price),
      purchaseOnly: !!r.purchase_only,
    })),
  ].filter((u) => u.price > 0 && !u.purchaseOnly);

  if (sellableUnits.length === 0) return null;

  const lines = sellableUnits.map((u) => {
    const unitsFit = totalQty / u.conversionQty;
    const revenue = unitsFit * u.price;
    const profit = revenue - totalModal;
    const markup = totalModal > 0 ? (profit / totalModal) * 100 : 0;
    return {
      name: u.name,
      price: u.price,
      isWholeBatchUnit: u.conversionQty === totalQty,
      unitsFit,
      revenue,
      profit,
      markup,
    };
  });

  return {
    referenceUnitName: referenceRow.unit_name,
    baseUnitName: form.unit || "satuan dasar",
    totalQty,
    totalModal,
    lines,
  };
}
